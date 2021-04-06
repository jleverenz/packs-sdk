"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFormulaOrSync = exports.executeFormulaOrSyncWithRawParams = exports.setupIvmContext = exports.registerBundle = void 0;
const build_1 = require("../cli/build");
const fs_1 = __importDefault(require("fs"));
const isolated_vm_1 = __importDefault(require("isolated-vm"));
const path_1 = __importDefault(require("path"));
const IsolateMemoryLimit = 128;
const CodaRuntime = '__coda__runtime__';
// execution_helper_bundle.js is built by esbuild (see Makefile) 
// which puts it into the same directory: dist/testing/
const CompiledHelperBundlePath = `${__dirname}/execution_helper_bundle.js`;
const HelperTsSourceFile = `${__dirname}/execution_helper.ts`;
// Maps a local function into the ivm context.
async function mapCallbackFunction(context, stubName, method) {
    await context.evalClosure(`${stubName} = function(...args) {
       $0.applyIgnored(undefined, args, { arguments: { copy: true } });} `, [(...args) => method(...args)], { arguments: { reference: true }, result: { copy: true } });
}
// Maps a local async function into the ivm context.
async function mapAsyncFunction(context, stubName, method) {
    await context.evalClosure(`${stubName} = async function(...args) {
      return $0.apply(
        undefined, 
        args, 
        { 
          arguments: {copy: true}, 
          result: {copy: true, promise: true},
        },
      );
    }`, [(...args) => method(...args)], { arguments: { reference: true } });
}
async function registerBundle(isolate, context, path, stubName) {
    // init / reset global.exports for import. Assuming the bundle is following commonJS format.
    // be aware that we don't support commonJS2 (one of webpack's output format).
    await context.global.set('exports', {}, { copy: true });
    // compiling the bundle allows IVM to map the stack trace.
    const bundle = fs_1.default.readFileSync(path).toString();
    // bundle needs to be converted into a closure to avoid leaking variables to global scope.
    const script = await isolate.compileScript(`(() => { ${bundle}; ${stubName} = exports })()`, { filename: `file:///${path}` });
    await script.run(context);
}
exports.registerBundle = registerBundle;
function getStubName(name) {
    return `${CodaRuntime}.${name}`;
}
async function setupExecutionContext(ivmContext, executionContext) {
    const runtimeContext = await ivmContext.global.get(CodaRuntime, { reference: true });
    // set up a stub to be copied into the ivm context. we are not copying executionContext directly since
    // part of the object is not transferrable. 
    const executionContextStub = {
        ...executionContext,
        // override the non-transferrable fields to empty stubs. 
        fetcher: {},
        temporaryBlobStorage: {},
        logger: {},
    };
    await runtimeContext.set('executionContext', executionContextStub, { copy: true });
    await mapAsyncFunction(ivmContext, getStubName('executionContext.fetcher.fetch'), executionContext.fetcher.fetch.bind(executionContext.fetcher));
    await mapAsyncFunction(ivmContext, getStubName('executionContext.temporaryBlobStorage.storeUrl'), executionContext.temporaryBlobStorage.storeUrl.bind(executionContext.temporaryBlobStorage));
    await mapAsyncFunction(ivmContext, getStubName('executionContext.temporaryBlobStorage.storeBlob'), executionContext.temporaryBlobStorage.storeBlob.bind(executionContext.temporaryBlobStorage));
    await mapCallbackFunction(ivmContext, getStubName('executionContext.logger.trace'), executionContext.logger.trace.bind(executionContext.logger));
    await mapCallbackFunction(ivmContext, getStubName('executionContext.logger.debug'), executionContext.logger.debug.bind(executionContext.logger));
    await mapCallbackFunction(ivmContext, getStubName('executionContext.logger.info'), executionContext.logger.info.bind(executionContext.logger));
    await mapCallbackFunction(ivmContext, getStubName('executionContext.logger.warn'), executionContext.logger.warn.bind(executionContext.logger));
    await mapCallbackFunction(ivmContext, getStubName('executionContext.logger.error'), executionContext.logger.error.bind(executionContext.logger));
}
async function createIvmContext(isolate) {
    // context is like a container in ivm concept.
    const ivmContext = await isolate.createContext();
    // create global for the context. Otherwise it's going to be a reference object.
    const jail = ivmContext.global;
    await jail.set('global', jail.derefInto());
    // security protection
    await jail.set('eval', undefined, { copy: true });
    await ivmContext.eval('Function.constructor = undefined');
    await ivmContext.eval('Function.prototype.constructor = undefined');
    // coda runtime is used to store all the variables that we need to run the formula. 
    // it avoids the risk of conflict if putting those variables under global.
    await ivmContext.global.set(CodaRuntime, {}, { copy: true });
    // for debugging purpose, map console.log into the ivm context. it should be removed once we 
    // hook logger into the execution context.
    await ivmContext.global.set('console', {}, { copy: true });
    // eslint-disable-next-line no-console
    await mapCallbackFunction(ivmContext, 'console.log', console.log);
    return ivmContext;
}
async function setupIvmContext(bundlePath, executionContext) {
    // creating an isolate with 128M memory limit.    
    const isolate = new isolated_vm_1.default.Isolate({ memoryLimit: IsolateMemoryLimit });
    const ivmContext = await createIvmContext(isolate);
    const bundleFullPath = bundlePath.startsWith('/') ? bundlePath : path_1.default.join(process.cwd(), bundlePath);
    await registerBundle(isolate, ivmContext, bundleFullPath, getStubName('pack'));
    // If the ivm helper is running by node, the compiled execution_helper bundle should be ready at the 
    // dist/ directory described by CompiledHelperBundlePath. If the ivm helper is running by mocha, the 
    // bundle file may not be available or update-to-date, so we'd always compile it first from 
    // HelperTsSourceFile.
    //
    // TODO(huayang): this is not efficient enough and needs optimization if to be used widely in testing.
    if (fs_1.default.existsSync(CompiledHelperBundlePath)) {
        await registerBundle(isolate, ivmContext, CompiledHelperBundlePath, getStubName('bundleExecutionHelper'));
    }
    else if (fs_1.default.existsSync(HelperTsSourceFile)) {
        const bundlePath = await build_1.build(HelperTsSourceFile, 'esbuild');
        await registerBundle(isolate, ivmContext, bundlePath, getStubName('bundleExecutionHelper'));
    }
    else {
        throw new Error('cannot find the execution helper');
    }
    await setupExecutionContext(ivmContext, executionContext);
    return ivmContext;
}
exports.setupIvmContext = setupIvmContext;
async function executeFormulaOrSyncWithRawParams(ivmContext, formulaName, rawParams) {
    return ivmContext.evalClosure(`return ${getStubName('bundleExecutionHelper')}.executeFormulaOrSyncWithRawParams(
      ${getStubName('pack.manifest')}, 
      $0, 
      $1, 
      ${getStubName('executionContext')}
    )`, [formulaName, rawParams], { arguments: { copy: true }, result: { copy: true, promise: true } });
}
exports.executeFormulaOrSyncWithRawParams = executeFormulaOrSyncWithRawParams;
async function executeFormulaOrSync(ivmContext, formulaName, params) {
    return ivmContext.evalClosure(`return ${getStubName('bundleExecutionHelper')}.executeFormulaOrSync(
      ${getStubName('pack.manifest')}, 
      $0, 
      $1, 
      ${getStubName('executionContext')}
    )`, [formulaName, params], { arguments: { copy: true }, result: { copy: true, promise: true } });
}
exports.executeFormulaOrSync = executeFormulaOrSync;