# Best practices

While it's easy to get started building a Pack, there are lots of options to explore and decisions to make as you go. This page includes some best practices we've learned through developing our own Packs that we encourage you to consider.


## Formulas

- [x] Follow the guidance on [formula naming][formulas_naming].
- [x] Ensure each formula has a few [examples defined][formulas_examples]. These show up in the generated documentation for the formula.
- [x] Set a [suggested value][parameter_suggested_value] for required parameters. This allows users to drag the formula from the side panel and see a result immediately.
- [x] For each formula that has only a single required parameter, consider exposing it as a [column format][column_formats]. This makes it easier for users to use the functionality in a table.
- [x] Consider the [caching behavior][formulas_caching] of your formulas. Use longer cache times for formulas where the results are deterministic, and shorter cache times for ones that fetch external data.


## Actions

- [x] Follow the guidance on [action naming][actions_naming].
- [x] Ensure each action formula [returns a result][actions_result]. This allows the doc to react to the action being completed.


## Column formats

- [x] Follow the guidance on [column format naming][column_formats_naming].
- [x] For column formats that use a URL as input, [add a matcher pattern][column_formats_matchers]. This allows Coda to apply the format automatically when a user adds a compatible URL to a table.


## Sync tables

- [x] Follow the guidance on [sync table naming][sync_tables_naming].
- [x] Set the [`description`][SyncTableOptions.description] field for each sync table. The description is shown on the Pack's listing page and helps a user understand what data it retrieves.
- [x] [Add parameters][sync_tables_parameters] to sync tables to allow for filtering. Filtering is particularly important when a table can return a large number of rows.
- [x] Consider the [caching behavior][sync_tables_caching] of your sync tables. Most fetcher requests should have their caching reduced or disabled to ensure the latest results are synced.


## General

- [x] When using per-user authentication, make sure to set the [`instructionsUrl`][instructionsUrl] field. Direct user to a help center article that provides information about where they can find the required tokens or credentials.
- [x] Throw a [`UserVisibleError`][UserVisibleError] for bad input or when an expected type of error occurs. This allows you to provide a more informative error message to the user.



[formulas_naming]: blocks/formulas.md#naming
[formulas_caching]: blocks/formulas.md#caching
[actions_naming]: blocks/actions.md#naming
[actions_result]: blocks/actions.md#results
[column_formats]: blocks/column-formats.md
[column_formats_naming]: blocks/column-formats.md#naming
[column_formats_matchers]: blocks/column-formats.md#matchers
[sync_tables_naming]: blocks/sync-tables.md#naming
[sync_tables_caching]: blocks/sync-tables.md#caching
[sync_tables_parameters]: blocks/sync-tables.md#parameters
[formulas_examples]: blocks/formulas.md#examples
[parameter_suggested_value]: basics/parameters.md#suggested-values
[instructionsUrl]: ../reference/sdk/interfaces/BaseAuthentication.md#instructionsurl
[UserVisibleError]: ../reference/sdk/classes/UserVisibleError.md
[SyncTableOptions.description]: ../reference/sdk/interfaces/SyncTableOptions.md#description