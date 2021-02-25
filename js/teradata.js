/**
 * Copyright © 2019 by Teradata.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function (window, document, angular, $) {

  if (typeof window === 'undefined' || !window) {
    throw new Error('DOM Window not present!')
  } else if (typeof document === 'undefined' || !document) {
    throw new Error('DOM Document not present!')
  } else if (typeof angular === 'undefined' || !angular) {
    throw new Error('Angular library not present!')
  } else if (typeof $ === 'undefined' || !$) {
    throw new Error('jQuery library not present!')
  }

  const app = angular.module('teradata-vantage.module', []);

  app.controller('TeradataVantageController', function ($scope, $timeout) {

    /**
     * A wrapper function that delays execution so that
     * the Angular rendering cycle will have finished before
     * running the given function f.
     */
    const $delay = f => $timeout(f, 100);
    
    const $twicedelay = g =>$timeout(g,200);

    /**
     * Default separator for list-like objects.
     */
    const SEPARATOR = String.fromCharCode(0);

    /**
     * A private variable containing the function metadata.
     */
    let functionMetadata;

    /**
     * A private variable containing the function metadata.
     */
    let functionVersion = '';
    let functionType = '';

    /**
     * A private variable containing the function to run the given recipe.
     */
    let runFunction;

    /**
     * Dialog container.
     */
    const $dialog = $('#dialog');

    /**
     * Validation dialog container.
     */
    const $validationDialog = $('#dialog-validation');

    /**
     * Function metadata path - this path contains the JSON metadata of each function.
     */
    const FUNCTION_METADATA_PATH = '/plugins/TeradataVantageSQLEFunctionsPlugin/resource/data/';

    /**
     * Parameters to use for the dialog box.
     */
    const DIALOG_PARAMETERS = {
      modal: true,
      width: '33%',
      minHeight: 250,
    }

    /**
     * Parameters to use for the dialog box CSS.
     */
    const DIALOG_CSS_PARAMETERS = {
      'max-height': '70vh',
      overflow: 'auto'
    }

    /**
     * Number of milliseconds per listen interval.
     */
    const LISTEN_INTERVAL = 50;

    /**
     * Object keys that are repeatedly used in this script.
     */
    const KEYS = {
      LONG_DESCRIPTION: 'long_description',
      ALTERNATE_NAMES: 'alternateNames',
      TARGET_TABLE: 'targetTable',
      INPUT_TABLE: 'INPUTTABLE',
      INPUT_TABLE_ALTERNATIVE: 'INPUT_TABLE'
    }

    /** Regex for locating HTML entities. */
    const ENTITY_REGEX = /[\u00A0-\u9999<>\&]/gim

    /** Properly encodes an HTML entity. */
    function encodeRegex(i) {
      return '&#' + i.charCodeAt(0) + ';';
    }

    $.extend($scope, {

      /**
       * Shows a dialog.
       * 
       * This is for displaying Aster-side errors.
       */
      dialog: function (title, content, elem) {

        // [HACK] Sometimes, the title is "error" because of timing issues.
        // So we force it to succeed if the content is "Job succeeded".
        if (content === 'Job succeeded.') {
          title = 'Success'
        }

        $dialog.find('pre').text(content);
        $(elem).click(() => $('.ui-dialog-content').dialog('close'));
        $dialog.find('.other').empty().append(elem);

        $dialog
          .attr('title', title)
          .dialog(DIALOG_PARAMETERS);

        $dialog.css(DIALOG_CSS_PARAMETERS);

      },

      /**
       * Shows a dialog.
       * 
       * This is for displaying frontend validation errors.
       */
      validationDialog: function (html) {

        $validationDialog.find('div').html(html);
        $validationDialog.dialog(DIALOG_PARAMETERS);
        $validationDialog.css(DIALOG_CSS_PARAMETERS);

      },

      /**
       * Gets the static JSON metadata of the given function.
       */
      getFunctionMetadata: function (selectedFunction, shouldSetDefaults) {
        console.log("Getting function metadata.")

        if (typeof selectedFunction === 'undefined') {
          return;
        }
        // console.log(${tbl:datasetname});
        const promise = $http
          // .get(`${FUNCTION_METADATA_PATH}${selectedFunction}_mle.json`, {
          .get(`${FUNCTION_METADATA_PATH}${selectedFunction}.json`, {
            transformResponse: [function (data) {
              if (typeof data === 'string') {                
                // strip json vulnerability protection prefix
                data = data.replace(")]}',\n", '');
                data = data.replace(/: Infinity/g, ': "Infinity"');
                data = data.replace(/: -Infinity/g, ': "-Infinity"');             
                // WARNING DANGEROUS STRING REPLACEMENT
                data = data.replace(/NaN(?!.*")/g,'"NaN"')  
                // data = data.replace(/^\t|\s*\-NaN/g, '"-NaN"');
                // console.log(JSON.stringify({ "x" : NaN }, undefined, 2));
                // data = data.replace(/^\t|\s*NaN/g, '"NaN"');                
                data = JSON.parse(data, function censor(key, value) {
                  value == Infinity ? "Infinity" : value;
                  value == NaN ? "NaN" : value;
                  return value
                });
                // data = JSON.parse(data, function censor(key, value) {
                //   return value == NaN ? "NaN" : value;
                // });
              }
              console.log(data)
              return data;
            }]
          })
          .success(data => {
            functionMetadata = data;
            // console.log('Function Metadata MR Test');
            // console.log(functionMetadata);
            // console.log($scope.config.function)
            functionVersion = functionMetadata.function_version;
            // PARTITION BY BLANK
            $scope.config.function.partitionAttributes = $scope.config.function.partitionAttributes || [''];
            $scope.config.function.orderByColumn = $scope.config.function.orderByColumn || [''];
            // $scope.config.function.orderByColumnDirection = $scope.config.function.orderByColumnDirection || []
            $scope.preprocessDescriptions();
            $scope.preprocessMetadata(shouldSetDefaults);
            $scope.activateTabs();
            $scope.activateMultiTagsInput();
            $scope.activateTooltips();
          })

      },

      /**
       * Preprocesses the descriptions so that the special characters are correctly rendered.
       */
      preprocessDescriptions: function () {

        if (!functionMetadata || !functionMetadata.argument_clauses)
          return;

        functionMetadata.argument_clauses.forEach(
          x => {
            try {

              x.description = x.description
                ? x.description.replace(ENTITY_REGEX, encodeRegex)
                : ''

            } catch (e) { }
          }
        )

      },

      /**
       * Gets the function description from the static JSON metadata.
       */
      getFunctionDescription: function () {
        return (functionMetadata && KEYS.LONG_DESCRIPTION in functionMetadata) ?
          functionMetadata.long_description :
          '';

      },

      multiColumnNamesCheck: function(item){
        var result = (item.datatype == 'COLUMN_NAMES' || item.datatype == 'COLUMNS') && item.allowsLists;
        // if (result && (item.value == null || item.value == "")){
        //   item.value = [""];
        // }
        // console.log('Multi check');
        // console.log(item.name);
        // console.log(result);
        return result;
      },

      resetSelectToStar() {
        
        $scope.config.function.select_clause = '*';
 
      },

      /**
       * Checks if there is a version mismatch in function_version
       */
      // checkVersionMismatch: function () {
    	//   if (!$scope.config.function) {
      //       return false;
      //       }
      //   var previousVersion = $scope.config.function.function_version ? $scope.config.function.function_version : '';
      //   console.log($scope.config.function.function_version ? $scope.config.function.function_version : '');
      //   // console.log(functionVersion);
      //   if (($scope.config.function.function_version ? $scope.config.function.function_version : '') === functionVersion || ($scope.config.function.function_version ? $scope.config.function.function_version : '') === '') {
      //     console.log('False');
      //     return false;
      //   } else {
      //     console.log('True')
      //     console.warn('Function version mismatch');
      //     console.warn('Previous Version:', previousVersion)
      //     console.warn('Installed Version:', functionVersion)
      //     return true;
      //   }
      // },
      addPartitionByColumn_TEST: function(partitionArray) {
        // console.log('Partition array type');
        // console.log(typeof partitionArray);
        // console.log(partitionArray);
        if(typeof partitionArray == undefined || typeof partitionArray == 'string'){
          // console.log('Originally undefined/string');          
          partitionArray = [];
          // console.log(partitionArray)
          partitionArray.push('');
          // console.log(partitionArray)
          
        } else {          
          partitionArray.push('');
          // console.log('Added to partition array');
          // console.log(partitionArray);
          
        
        }
    },
    

    addColumnArgument: function(item) {
      console.log('Adding value to array');
      console.log(item.name);
      console.log(item.value);
      item.value.push("");
    },

    removeColumnArgument: function(item, index) {
      if (index > -1) {
          item.value.splice(index, 1);
      }
  },

  addAdditionalSQLClause: function() {    
    if($scope.config.function.additionalSQLClause == null){
      $scope.config.function.additionalSQLClause = [""];
    } else{ 
      $scope.config.function.additionalSQLClause.push("");
    }
    
  },

  removeAdditionalSQLClause: function(index) {
    if (index > -1) {
      $scope.config.function.additionalSQLClause.splice(index, 1);
    }
},
  
    initializeColumnArray: function(columnArray){
      columnArray = columnArray || [''];
      return columnArray;
    },

    initializeColumnArrayOptional: function(columnArray){
      // MOdified this too
      columnArray = columnArray || [''];
      return columnArray;
    },
    
    removePartitionByColumn_TEST: function(partitionArray,index) {
      if (index > -1) {
        // console.log('Removed from partition array')
        // console.log(partitionArray)
        partitionArray.splice(index, 1);
      }
    },

    addPartitionByColumn: function() {
      // console.log('Added one column')
      $scope.config.function.partitionAttributes.push('');
  },
  removePartitionByColumn: function(index) {
    if (index > -1) {
        $scope.config.function.partitionAttributes.splice(index, 1);
    }
  },

  addOrderByColumn: function() {
    // console.log('Added one column')
    $scope.config.function.orderByColumn.push('');
    $scope.config.function.orderByColumnDirection.push('');
  },
  removeOrderByColumn: function(index) {
    if (index > -1) {
      $scope.config.function.orderByColumn.splice(index, 1);
      $scope.config.function.orderByColumnDirection.splice(index, 1);
    }
  },

  addOrderByColumn_WITHDIR: function(orderArray, orderDirArray) {
    // console.log('Partition array type');
    // console.log(typeof orderArray);
    // console.log(orderArray);
    if(typeof orderArray == undefined || typeof orderArray == 'string'){
      // console.log('Originally undefined/string');          
      orderArray = [];
      // console.log(orderArray)
      orderArray.push('');
      // console.log(orderArray)
      
    } else {          
      orderArray.push('');
      // console.log('Added to partition array');
      // console.log(partitionArray);         
    }
    // DIRECTION
    if(typeof orderDirArray == undefined || typeof orderDirArray == 'string'){               
      orderDirArray = [];        
      orderDirArray.push('');
      
      
    } else {          
      orderDirArray.push('');
      // console.log('Added to partition array');
      // console.log(partitionArray);         
    }
},
removeOrderByColumn_WITHDIR: function(orderArray, orderDirArray, index) {
  if (index > -1) {
    // console.log('Removed from partition array')
    // console.log(orderArray)
    orderArray.splice(index, 1);
    orderDirArray.splice(index, 1);
  }
},
      validityChanger: function () {
        $('div.ng-invalid').removeClass('ng-invalid')
        $('div.invalid').addClass('ng-invalid')
        return true;
      },

      /**
       * Checks if function is a driver function
       */
      checkIfDriverFunction: function () {
        // Move check above with IF statement and IF FALSE, set recipe output = ""
          return functionMetadata && functionMetadata.output_tables &&
              functionMetadata.output_tables.filter(arg => arg.isOutputTable).length;
      },

      /**
       * Checks if argument has Native JSON
       */
      hasNativeJSON: function (functionName) {          
        if (functionName == null || functionName == "") {
          return false;
        }
        // console.log('functionName');
        // console.log(functionName);
        var filteredChoices = $scope.choices.filter(choice => choice.name == functionName);      
        // console.log(filteredChoices);        
        if(filteredChoices[0].hasNativeJSON == false){
          $scope.config.function.useCoprocessor = true;
        }
        return filteredChoices[0].hasNativeJSON;
    },

    useNativeOrNot: function(inNative){
      // console.log('useNativeOrNot')
      // console.log($scope.config.function.useCoprocessor)
      // console.log(inNative)
      // if()
      return true;

    },

    refreshTeraTabs: function(){
      
      // $delay(() => {$scope.activateMultiTagsInput();
      $scope.activateMultiTagsInput();
     //this line is to watch the result in console , you can remove it later	
      console.log("Refreshed");
    // }) 
    },


      /**
       * Gets the description of the given argument from the static JSON metadata.
       */
      getArgumentDescription: function (i) {

        try {

          return (functionMetadata && functionMetadata.argument_clauses[i])
            ? functionMetadata.argument_clauses[i].description
            : null;

        } catch (e) {

          return null

        }

      },

      getArgumentWithName: function (name) {
          return (functionMetadata && functionMetadata.argument_clauses) ?
                  functionMetadata.argument_clauses.find(argument => (argument.
                          name.toUpperCase() === name.toUpperCase()) ||
                          (argument.alternateNames && argument.alternateNames.
                                  findIndex(x=> x.toUpperCase() === name.toUpperCase() ) != -1)) :
                      null;
      },

      getPermittedValuesWithName: function (item) {
    	  let name = item.name;
          let argument = $scope.getArgumentWithName(name);
          let permittedvalues = argument && argument.permittedValues && argument.permittedValues.length ?
        		  argument.permittedValues : null;
          //if (permittedvalues && item.allowsLists && (typeof item.value === 'string')) {
        	//  item.value = item.value.split(',');
          //}
          return permittedvalues;
      },

      getArgumentDescriptionWithName: function (name) {
          let argument = $scope.getArgumentWithName(name);
          return argument ? argument.description : null;
      },

      getArgumentFormattedName: function (name) {
          let argument = $scope.getArgumentWithName(name);
          return argument ? argument.name.replace(/([A-Z]+)/g, " $1")
                  .replace(/([A-Z][a-z])/g, " $1").split('_').join(' ')
                  : name;
      },

      getPermittedValues: function (i) {

        try {
          return (functionMetadata
            && functionMetadata.argument_clauses[i]
            && functionMetadata.argument_clauses[i].permittedValues
            && functionMetadata.argument_clauses[i].permittedValues.length)
            ? functionMetadata.argument_clauses[i].permittedValues
            : null;

        } catch (error) {

          return null;

        }


      },

      /**
       * Gets the schema of the unaliased inputs from the static JSON metadata.
       */
      getSchemaOfUnaliasedInputs: function (unaliasedInputsList) {

        if (!unaliasedInputsList
          || !unaliasedInputsList.values
          || !unaliasedInputsList.values.length)
          return [];

        const targetTableName = unaliasedInputsList.values[0];

        return $scope.inputschemas
          && targetTableName
          && targetTableName in $scope.inputschemas
          ? $scope.inputschemas[targetTableName]
          : []

      },
      // TODO: FIX THIS
      findTableNameInArgumentsList: function (argumentsList, tableNameAlias) {
        //Get alternate names
        var tableNameAliases = [];
        // tableNameAliases.push(tableNameAlias);
        //TODO: Change naming
        tableNameAliases = tableNameAlias;
        if (!functionMetadata) {
          return [''];
        }
        functionMetadata.argument_clauses.map(argument => {
          if (argument.name.toUpperCase() === tableNameAlias) {
            if (KEYS.ALTERNATE_NAMES in argument) {
              argument.alternateNames.map(function (altname) { tableNameAliases.push(altname); })
            }
          }
        })
        let potentialMatches = argumentsList
          .filter(arg => tableNameAliases.includes(arg.name.toUpperCase()));
        if (potentialMatches.length) {
          if (tableNameAlias.length > 1) {
            return potentialMatches.map(function (match) {
              return match.value
            });
          } else {
            return [potentialMatches[0].value];
          }
        }
        return ['']

      },

      // Opens tabs
      openTabs: function(evt, tabName) {
        // Declare all variables
        var i, tabcontent, tablinks;
        // console.log(evt); 
        // Get all elements with class="tabcontent" and hide them
        tabcontent = document.getElementsByClassName("plugintabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
    
        // Get all elements with class="tablinks" and remove the class "active"
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
    
        // Show the current tab, and add an "active" class to the button that opened the tab
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    },
    
    initTab:function(){
      $delay(() => {console.log('InitTab Happens');
      document.getElementById("defaultOpen").click();
      });
    },
      /**
       * Gets the function schema by joining and processing the metadata from the python backend 
       * and the static JSON file associated with the function.
       */
      getSchema: function (functionArgument, aliasedInputsList, unaliasedInputsList, argumentsList) {
        console.log('Get Schema runs');
        aliasedInputsList = aliasedInputsList || []
        argumentsList = argumentsList || []
        // console.log('getSchema');
        // console.log(functionMetadata)
        // console.log(functionArgument);
        // console.log(aliasedInputsList);
        // console.log(unaliasedInputsList);
        // console.log(argumentsList);
        const hasTargetTable = KEYS.TARGET_TABLE in functionArgument
        let targetTableName = ''
        var isAliasedInputsPopulated;
        var isInAliasedInputsList = false;
        // Alternate name variables
        var isInAlternateNames = false;
        var alternateNameIndex = 0;
        var alternateNameOriginalName = '';
        var y = false;
        if (hasTargetTable) {
          var targetTableAlias;
          if (typeof functionArgument.targetTable === 'string') {
            targetTableAlias = [(functionArgument.targetTable || '').toUpperCase()];
            console.log('Table name');
            console.log(targetTableAlias);
          } else {
            targetTableAlias = functionArgument.targetTable.map(function (table_name) {

              return (table_name || '').toUpperCase();
            })
            console.log('Table name');
            console.log(targetTableAlias);
          }

          // if (KEYS.ALTERNATE_NAMES in func)
          // var tableAliasList = 

          // const isAliased = KEYS.INPUT_TABLE !== targetTableAlias;
          // TODO: Look into this
          if (aliasedInputsList !== []) {
            isAliasedInputsPopulated = true;
            console.log('Into Alias Inputs');
            aliasedInputsList.map((input) => {
              // if (input.name.toUpperCase() === targetTableAlias.toUpperCase()) {
              if (targetTableAlias.includes(input.name.toUpperCase())) {
                console.log('Alias inputs true');
                isInAliasedInputsList = true;
              }
              // Test code
              console.log('Alternate names');
              console.log(input.alternateNames);    
              console.log(input.name)
              console.log(input)
              if(input.alternateNames != [] && input.alternateNames != undefined){        
                console.log("Got in");        
                console.log(input.alternateNames)
                for (var altNameIndex=0;altNameIndex<input.alternateNames.length;altNameIndex++ ){
                  console.log('Table Alternate name\n');
                  console.log(input.alternateNames[altNameIndex].toUpperCase());
                  console.log(targetTableAlias)
                  if(targetTableAlias.includes(input.alternateNames[altNameIndex].toUpperCase())){
                    console.log('includes alternate')
                    isInAliasedInputsList = true;
                    isInAlternateNames = true;
                    alternateNameIndex = altNameIndex;
                    alternateNameOriginalName = input.name.toUpperCase();
                  }
                }
              }
            }
            )
          } else {
            isInAliasedInputsList = false;
            console.log('Not in alias input anymore');
          }
          // const isAliased = aliasedInputsList.includes(targetTableAlias);
          const isAliased = isInAliasedInputsList;
          //console.log(KEYS.INPUT_TABLE);
          //console.log(targetTableAlias);
          // console.log('Aliased Inputs List Check');
          // console.log(aliasedInputsList);
          if (isAliased) {
            console.log('isAliased');
            // let matchingInputs = aliasedInputsList.filter(input => targetTableAlias === input.name.toUpperCase());
            let matchingInputs = aliasedInputsList.filter(input => targetTableAlias.includes(input.name.toUpperCase()));
            if (matchingInputs.length > 0) {
              //console.log('Matching inputs > 0');
              // targetTableName = matchingInputs[0].value;
              // matchingInputs[targetTableAlias.length - 1].value
              if(isInAlternateNames){
                  let matchingInputsAlt = aliasedInputsList.filter(input => input.alternateNames.some(r=> targetTableAlias.includes(r.toUpperCase())));
                  console.log(matchingInputsAlt)
                  if (matchingInputsAlt.length > 0) {               
                    // targetTableNameAlt = matchingInputsAlt.map(function(input) {
                    //   return input.value
                    // });
                    console.log("matching");
                    console.log(matchingInputs);
                    console.log(matchingInputsAlt)
                    matchingInputs = matchingInputs.concat(matchingInputsAlt);
                   }
              }
              targetTableName = matchingInputs.map(function(input) {
                return input.value
              });
            } else if (matchingInputs == 0 && isInAlternateNames){ //Alternate names additional code
              // console.log('Is in alternates and matching was 0')
              let matchingInputs = aliasedInputsList.filter(input => input.alternateNames.some(r=> targetTableAlias.includes(r.toUpperCase())));
              // console.log(matchingInputs)
              if (matchingInputs.length > 0) {               
                targetTableName = matchingInputs.map(function(input) {
                  return input.value
                });
              }
            } else {
              //console.log('Matching inputs < 0');
              // console.log('Does Matching <= 0 happen?')
              targetTableName = $scope.findTableNameInArgumentsList(argumentsList, targetTableAlias);
            }


          } else {
            //console.log('isNotAliased');
            //console.log(unaliasedInputsList);
            if (unaliasedInputsList.count && unaliasedInputsList.values && unaliasedInputsList.values.length) {
              // console.log('Went to unaliased');

              targetTableName = [unaliasedInputsList.values[0]];
              //console.log(targetTableName);
            }

            else {
              targetTableName = $scope.findTableNameInArgumentsList(argumentsList, targetTableAlias);
              // console.log('Went to arguments');
              // console.log(targetTableName);
            }


          }

        } else if (unaliasedInputsList.values && unaliasedInputsList.values.length > 0) {

          targetTableName = [unaliasedInputsList.values[0]];
          //console.log('This else if');
          //console.log(targetTableName);

        }

        if (!targetTableName || !$scope.inputschemas) {
          //console.log('This happened');
          //console.log(targetTableName);
          //console.log($scope);
          return [];
        }


        if (targetTableName) {
          //console.log('Schemas');
          //console.log($scope.inputschemas[targetTableName]);
          var forReturnInputSchemas = [];
          for (var i = 0; i < targetTableName.length; i++) {
            if (targetTableName[i] in $scope.inputschemas) {
              var currentInputSchemas = $scope.inputschemas[targetTableName[i]]
              currentInputSchemas = currentInputSchemas.map(function (eachInput) {
                return $.extend(eachInput, { "tableName": targetTableName[i] });
              })
              // console.log('Current');
              // console.log(currentInputSchemas);
              forReturnInputSchemas.push.apply(forReturnInputSchemas, currentInputSchemas)
            }
          }
          // console.log('Schema');
          // console.log(forReturnInputSchemas)
          return forReturnInputSchemas;

        }

        return $scope.schemas;

      },

      /**
       * Checks whether or not we should show the partition order fields.
       * 
       * NOTE: Temporary code to not show partition 
       * and order by fields when there are no unaliased input dataset
       */
      shouldShowPartitionOrderFields: function (unaliasedInputsList) {
        return unaliasedInputsList && unaliasedInputsList.count > 0;
      },

      /**
       * Checks whether or not the given argument is an output table or not.
       */
      isArgumentOutputTable: function (functionArgument) {
        return functionArgument.isOutputTable
      },

      /**
       * Checks whether or not required arguments are present in the function metadata.
       */
      hasRequiredArguments: function () {

        if (!$scope.config.function.arguments || !$scope.config.function.arguments.length)
          return false
        
        const hasRequiredArgument = $scope.config.function.arguments.filter(x => x.isRequired).length > 0
        const hasRequiredOutputTable = $scope.config.function.output_tables.filter(x => x.isRequired).length > 0
        return hasRequiredArgument || hasRequiredOutputTable

      },

      /**
       * Checks whether or not optional arguments are present in the function metadata.
       */
      hasOptionalArguments: function () {

        const hasOptionalInputTable = $scope.config.function.required_input
          && $scope.config.function.required_input.length
          && ($scope.config.function.required_input.filter(x => !x.isRequired).length > 0);

        const hasOptionalArgument = $scope.config.function.arguments
          && $scope.config.function.arguments.length
          && ($scope.config.function.arguments.filter(x => !x.isRequired).length > 0)
          && ($scope.config.function.useCoprocessor || ($scope.config.function.arguments.filter(x => x.inNative && !x.isRequired).length > 0));
          // console.log('hasOptionalArguments');
          // console.log($scope.config.function.useCoprocessor);
          // console.log(($scope.config.function.arguments.filter(x => x.inNative).length > 0));
          const hasOptionalOutputTable = $scope.config.function.output_tables
          && $scope.config.function.output_tables.length
          && ($scope.config.function.output_tables.filter(x => !x.isRequired).length > 0);
        // console.log(hasOptionalInputTable);
        // console.log(hasOptionalArgument);
        // console.log(hasOptionalOutputTable);
        return hasOptionalInputTable || hasOptionalArgument || hasOptionalOutputTable;

      },

      /**
       * Checks whether or not optional arguments are present in the partnerfunction metadata.
       */
      hasOptionalArguments_Partner: function () {

        const hasOptionalInputTable = $scope.config.function.partnerFunction.required_input
          && $scope.config.function.partnerFunction.required_input.length
          && ($scope.config.function.partnerFunction.required_input.filter(x => !x.isRequired).length > 0);

        const hasOptionalArgument = $scope.config.function.partnerFunction.arguments
          && $scope.config.function.partnerFunction.arguments.length
          && ($scope.config.function.partnerFunction.arguments.filter(x => !x.isRequired).length > 0)
          && ($scope.config.function.partnerFunction.useCoprocessor || ($scope.config.function.partnerFunction.arguments.filter(x => x.inNative && !x.isRequired).length > 0));
          // console.log('hasOptionalArguments');
          // console.log($scope.config.function.useCoprocessor);
          // console.log(($scope.config.function.arguments.filter(x => x.inNative).length > 0));
          const hasOptionalOutputTable = $scope.config.function.partnerFunction.output_tables
          && $scope.config.function.partnerFunction.output_tables.length
          && ($scope.config.function.partnerFunction.output_tables.filter(x => !x.isRequired).length > 0);
        // console.log(hasOptionalInputTable);
        // console.log(hasOptionalArgument);
        // console.log(hasOptionalOutputTable);
        return hasOptionalInputTable || hasOptionalArgument || hasOptionalOutputTable;

      },

      /**
       * A function that listens for job results.
       * It accepts a callback function f that is executed after the results are received.
       * The presence or absence of the job results are listened to 
       * by using a simple setInterval (which checks for results every 50ms).
       * 
       * NOTE: This is a hack-ish implementation because we donot know how to listen to the job results properly.
       * If Dataiku publishes a proper DOM event then we should listen to that event instead.
       * But, currently, that event is not being published.
       */
      listenForResults: function (f) {
        const listener = setInterval(() => {
          const $jobResult = $('.recipe-editor-job-result')
          if ($jobResult.length && f()) {
            clearInterval(listener);
            $jobResult.remove();
          }
        }, LISTEN_INTERVAL)
      },

      /**
       * Function that validates all the input controls of the recipe.
       * 
       * Returns true if valid. If not, it shows an error dialog then returns false.
       */
      validate: function () {

        const invalids = []
        $('.ng-invalid:not(form,.ng-hide,div,ng-disabled)').each((i, x) => invalids.push($(x).parent().prev().text()))

        if (invalids.length) {
          $scope.validationDialog(`Please amend the following fields: <ul>${invalids.map(x => `<li>${x}</li>`).join('')}</ul>`)
          return false
        }

        return true

      },

      /**
       * Function to execute the "proper" run workflow of an Aster recipe.
       * 
       * Firstly, the inputs are validated.
       * If the inputs are valid, it proceeds to the run phase 
       * which runs the original runFunction of the recipe (which we hijacked earlier).
       * It then listens for any results by using the listenForResults function.
       * Once the results are back, it displays it in a jQuery UI dialog box.
       */
      runThenListen: function () {

        if (!$scope.validate()) return;

        //console.log(functionVersion);
        //console.log($scope.config.function.function_version);
        $scope.config.function.function_version = functionVersion;
        runFunction();

        $scope.listenForResults(function () {
          //console.log('Got results');
          // //console.log(message);
          //console.log(functionVersion);
          //console.log($scope.config.function.function_version);
          const $results = $('.alert:not(.ng-hide):not(.messenger-message)')

          if ($results.length === 0) return false;

          try {

            const title = $results.get(0).classList[1].split('-')[1]

            if (!title || title === 'info')
              return false

            const result = $results.find('h4').text()

            const $jobLinkClone = $results.find('a').last().clone(true, true)

            $results.remove()
            $scope.dialog(title, result, $jobLinkClone)

            return true

          } catch (e) { }

          return false

        })

      },

      /**
       * Resolves a code-conflict issue between jQuery and Bootstrap.
       */
      initializeBootstrap: function () {
        if ($.fn.button && $.fn.button.noConflict)
          $.fn.bootstrapBtn = $.fn.button.noConflict()
      },

      /**
       * Communicates with Python backend 
       * and acquires necessary data to display in the recipe UI.
       */
      communicateWithBackend: function () {

        $scope.callPythonDo({}).then(
          data => $.extend($scope, data),
          () => { }
        ).then(
          () => { 
                  if($scope.config.function.select_clause == null || $scope.config.function.select_clause == undefined){
                    $scope.resetSelectToStar()
                  }
                },
          () => {}
        );

      },

      /**
       * Activates the tabbing functionality of this recipe.
       */
      activateTabs: function () {
        try {
          $('#tabs').tabs('destroy')
        } catch (e) { }
        $('#tabs').tabs();
      },

      /**
       * Activates the informative tooltips of each input control.
       * Hijacks each tagsInput element so that it properly displays tooltips as well.
       */
      activateTooltips: function () {

        $('#main-container').tooltip();

        $delay(() => {

          $('.tagsinput').each((i, x) => {

            const original = $(x).prev().attr('data-original-title') || ''

            const title = original ?
              (original + '<br><br><b>(Press ENTER to add to list)</b>') :
              '<b>(Press ENTER to add to list)</b>'
            $(x).data({
              toggle: 'tooltip',
              container: 'body',
              placement: 'right',
              html: true,
              title: title,
              'original-title': title
            })
              .tooltip()

          });

        });

      },
      testPrint: function(element){
        $delay(() => {
        console.log('Testprint')
        // $('input.flexdatalist').trigger('change');
        // $('input.flexdatalist').trigger('input');
        // console.log(element.value);
        // console.log('==================================');
        // console.log(element);
        // console.log('==================================');
        // $scope.config.test_model = element;
        // console.log($scope.config.test_model);
        // alert($scope.config.test_model)

        // if XGBoost_Predict and if 
        });
      },
      changeInputModelTable: function(element){
        $delay(() => {
          if($scope.config.function.name == 'XGBoost_Predict'){
            if (element.name == 'Model'){
              // initialize
              $scope.config.function.required_input[1].orderByColumn = [''];
              $scope.config.function.required_input[1].orderByColumnDirection = [''];
  
              //Get list of column names
              var tableName = $scope.inputschemas[element.value];
  
              var listColumn = [];
              tableName.forEach(column => {
                listColumn.push(column.name);
              });
              // alert(listColumn);
  
              //if column name tree_id exist in the list
              var columnDefault = ['class_num', 'iter', 'tree_id'];
              columnDefault.forEach(column => {
                if (listColumn.includes(column)){
                  $scope.config.function.required_input[1].orderByColumn.unshift(column);
                  $scope.config.function.required_input[1].orderByColumnDirection.unshift('ASC');
                };
              });
            };
          };
        });
      },
      /**
       * Activates the multi-string input boxes.
       */
      activateMultiTagsInput: function () {
    	  $delay(() => {
        try {
            $('.flexdatalist').flexdatalist({
            minLength: 1,
            onChange: x => $(x).trigger('change')
            });
            
            $('input.flexdatalist').on('change:flexdatalist', function(event, set, options) {
              // console.log('The thing changed')
              // console.log(set.value);
              // console.log(set.text);
              // console.log(set);
              // console.log(event);
              // console.log(options);
              $(event.currentTarget).trigger('change');
              $(event.currentTarget).trigger('input');
              var ipt = event.currentTarget;
              // console.log(ipt);
              // console.log(event.target);
              // $(event.target).trigger('change');
              // $(event.target).trigger('input');
              // $scope.testPrint(event.currentTarget);
              // console.log($scope.config.test_model);
          });

            $('input.teradata-tags').tagsInput({
              interactive: true,
              unique: false,
              onChange: x => $(x).trigger('change'),
              defaultText: 'add param',
              delimiter: SEPARATOR
            });
          } catch (e) {console.error('activateMultiTagsInput: ' + e); }
    	  });
      },

      /** 
       * Hijacks the current click handler of the recipe
       * and replaces it with the runThenListen function.
       * 
       * Stores the original recipe run function in the runFunction variable.
       */
      activateValidation: function () {

        const $runButton = $('.btn-run-main')
        runFunction = $._data($runButton.get(0), 'events').click[0].handler.bind($runButton.get(0));
        $runButton
          .off('click')
          .on('click', e => $scope.runThenListen());

      },

      /**
       * Hijacks the current UI and applies a few cosmetic improvements.
       */
      activateCosmeticImprovements: function () {

        const $a = $('.mainPane > div:first > div:first > div.recipe-settings-section2 > a');
        $a
          .text('Teradata Vantage Analytic Functions\nLearn more about Teradata Vantage')
          .css('color', 'orange')
          .attr('target', '_blank')
          .attr('href', 'https://docs.teradata.com/');
        $a.html($a.html().replace(/\n/g,'<br/>'));
        $a.parent().css('text-align', 'center');
        $('#main-container > div > div:nth-child(1) > div > select')[0].value = '';
        $('.dss-page,#main-container').css('display', 'block');
        $('select:first, select:first > option').css('text-transform', 'capitalize');
        $('form').attr('novalidate', 'novalidate');

      },

      /**
       * Applies the custom changes to the default Dataiku UI needed for the Aster plugin to work.
       */
      activateUi: function () {

        $delay(() => {

          $scope.initializeBootstrap();

          $scope.activateCosmeticImprovements();
          $scope.activateTabs();
          $scope.activateMultiTagsInput();
          $scope.activateValidation();
                    
          
          
          $scope.reloader = true;
          
        });

      },

      cleanName: function (rawName) {

        return rawName.split('_').join(' ').toLowerCase()

      },

      cleanKind: function (rawKind) {

        return rawKind ? `(${rawKind})` : ''

      },

      /**
       * Preprocess function metadata.
       */
      preprocessMetadata: function (shouldBindDefaults) {

        if (
          !functionMetadata
          || !$scope.config
          || !$scope.config.function
          || !$scope.config.function.arguments
          || !$scope.config.function.arguments.length) return;

        $delay(() => {

          // Re-arrange functions alphabetically.
          if ($scope.choices) {
            $scope.choices = $scope.choices.sort((a, b) => a.name.localeCompare(b.name))
          }

          let i = 0;
          $scope.config.function.arguments.forEach(argument => {

            // Index each argument for easy access.
            argument.i = i;
            let permittedValues = $scope.getPermittedValuesWithName(argument);
            if (permittedValues && argument.allowsLists) {
            	let curvalue = argument.value;
            	if (typeof curvalue === 'string') {
            		argument.value = argument.value.split(',');
            	}
            }
            
            // if (result && (item.value == null || item.value == "")){
            //     item.value = [""];
            //   }
            console.log('Checking COLUMN NAMES');
            console.log(argument.name);
            console.log(argument.datatype == "COLUMN_NAMES");
            console.log(argument.allowsLists);
            console.log(!(argument.value.constructor === Array));
            if((argument.datatype == "COLUMN_NAMES" || argument.datatype == "COLUMNS") && argument.allowsLists && argument.isRequired && !(argument.value.constructor === Array)){
              argument.value = [""];
              console.log(argument.value);
            } else if ((argument.datatype == "COLUMN_NAMES" || argument.datatype == "COLUMNS") && argument.allowsLists && !argument.isRequired && !(argument.value.constructor === Array)){
              argument.value = [""];
              console.log(argument.value);
            }
            if((argument.datatype == "STRING") && argument.allowsLists && $scope.getPermittedValuesWithName(argument) && argument.isRequired && !(argument.value.constructor === Array)){
              argument.value = [""];
              console.log(argument.value);
            } 

           /* try {

              if (functionMetadata.argument_clauses[i]
                && typeof functionMetadata.argument_clauses[i].defaultValue != 'undefined') {
                argument.value = functionMetadata.argument_clauses[i].defaultValue;
              }

            } catch (e) {

            }*/
            ++i;
          });

          // Re-arrange argument order.
          $scope.config.function.arguments = [
            ...$scope.config.function.arguments.filter(x => x.datatype === 'TABLE_NAME'),
            ...$scope.config.function.arguments.filter(x => x.datatype !== 'TABLE_NAME'),
          ]
          $scope.initTab();
        });

      },

      /**
       * Initializes this plugin.
       */
      initialize: function () {
        // alert("Initialize")
        $scope.communicateWithBackend();
        if ($scope.config.function) {
          $scope.getFunctionMetadata($scope.config.function.name, !$scope.config.function);
          
        }
        
        $scope.preprocessMetadata(false);
        $scope.activateUi();
        // $scope.config.function.partitionAttributes = $scope.config.function.partitionAttributes || [];
        // $scope.config.function.orderByColumn = $scope.config.function.orderByColumn || [];

      },
      
      shouldRender: function () {
    	  return functionMetadata ? true : false;
      },

      /**
       * Initializes this plugin.
       */
      refresh: function (selectedFunction) {

        $scope.getFunctionMetadata(selectedFunction, true);
        $scope.preprocessMetadata(true);
        // document.getElementById("defaultOpen").click();
      }

    })

    $scope.reloader = false;
    $scope.initialLoading = true;
    $scope.initialize();

  });
})(window, document, angular, jQuery);

