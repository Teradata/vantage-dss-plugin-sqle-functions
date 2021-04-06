-------------------------------------------------------------------------
- README file: The Teradata Vantage SQL Engine Functions Plugin
-
- Version: 2.0-2
-
- March 2021
-
- Copyright (c) 2021 Teradata
-------------------------------------------------------------------------

The Teradata Vantage SQL Engine Functions Plugin allows end users to leverage
Vantage analytics within their DSS data science workflows. This plugin provides support
for a majority of the Advanced SQL Engine analytics functions in 16.20.

Note that Dataiku DSS itself also supports ANSI SQL push-down for most of their
data preprocessing Visual recipes.

The Plugins were tested with Vantage 2.0.

I. System Requirements
----------------------

The following component versions are required for the Teradata Vantage Plugin:

1. Dataiku Data Science Studio version 8.0.2 - 8.0.6
2. Teradata Vantage 2.0
3. Teradata JDBC Driver 16.20 (minimum), Teradata JDBC Driver 17.00 (recommended)

For R and Python support in Teradata Vantage, one or both of the following are
required:

1. 9687-2000-0120	R Interpreter and Add-on Pkg on Teradata Advanced SQL
2. 9687-2000-0122	Python Interpreter and Add-on Pkg on Teradata Advanced SQL


II. Install / Upgrade Instructions
----------------------------------

To install the Teradata Vantage SQL Engine Functions plugin for Dataiku DSS,
perform the following:

1. In DSS Settings page (accessible through the Admin Tools button),
   select the [Plugins] tab, then select the [ADVANCED] option.
2. Click on [Choose File] and browse to the location of the present plugin
   zip file in your local filesystem.
3. If a previous installation of present plugin exists, check "Is update".
4. Click on [UPLOAD] button.
5. When the upload succeeds, click on [Reload] button, or do a hard refresh
   (Ctrl + F5) on all open Dataiku browsers for the change to take effect.


III. Limitations
----------------

1. For analytic functions that:
   - take in output table names as arguments, and
   - where the select query produces only a message table indicating the name
     of the output model/metrics table, it is the responsibility of the user
	 to specify output table names that are different from those of the existing
	 tables.
   Some analytic functions provide an option to delete an already existing output
   table prior to executing an algorithm, but others do not. In the former case,
   the Advanced SQL Engine throws an "Already exists" exception.

2. The plugin only supports Vantage Advanced SQL Engine Database datasets as
   input and output.

3. Functions with any OUTPUT TABLE type arguments will require the user to add
   an output dataset for the SELECT statement results of the query and any
   additional output tables. Please refer to the Vantage Advanced SQL Engine
   Analytic Functions documentation page at docs.teradata.com to learn about
   the output tables of each function.

4. The following Advanced SQL Engine functions are not supported:
   - DecisionForestPredict
   - DecisionTreePredict
   - GLMPredict
   - NaiveBayesPredict
   - NaiveBayesTextClassifierPredict
   - SVMSparsePredict


IV. References
--------------

For additional information on the Teradata Vantage Advanced SQL Engine analytic
functions, search for the following on docs.teradata.com:

1. "Advanced SQL Engine Analytic Functions Overview"
2. "Teradata Vantage Advanced SQL Engine Analytic Functions"
3. "Teradata Vantage User Guide"


V. Changelog
------------

What’s new:
- Bug fix: The functions visual interface was distorted in DSS v.8.0.x.
- Bug fix: An older version of the functions JSON file caused the Pack and
  Unpack functions to invoke the nonexistent argument “Columns” instead of
  “Column”. Fix was made inline in existing JSON file.

Release          Date             Notes
Version 2.0-2    April 2021       Current; bug fix.
Version 2.0-1    December 2020    Initial release.
