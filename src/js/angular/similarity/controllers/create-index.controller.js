define([],
	function () {

		angular
			.module('graphdb.framework.similarity.controllers.create', [])
			.controller('CreateSimilarityIdxCtrl', CreateSimilarityIdxCtrl);

		CreateSimilarityIdxCtrl.$inject = ['$scope', '$http', '$interval', 'localStorageService', 'toastr', '$repositories', '$modal', '$timeout', 'SimilarityService', 'SparqlService', '$location', 'productInfo'];


		function CreateSimilarityIdxCtrl($scope, $http, $interval, localStorageService, toastr, $repositories, $modal, $timeout, SimilarityService, SparqlService, $location, productInfo) {

			let indexType = $location.search().type;
			if (indexType == undefined || indexType.startsWith('text')) {
				$scope.viewType = 'text';
			} else {
				$scope.viewType = indexType;
			}

			var textDefaultOptions = "-termweight idf";
			var predDefaultOptions = "";
			$scope.newIndex = {};

			$scope.info = productInfo;
			$scope.page = 1;


            SimilarityService.getSearchQueries().success(function(data) {
                $scope.searchQueries = data;
                SimilarityService.getSamples().success(function(samples) {
                    defaultTabConfig.query = $location.search().selectQuery ? $location.search().selectQuery : samples['text']['literals'];
                    defaultTabConfig.inference = !($location.search().infer == 'false');
                    defaultTabConfig.sameAs = !($location.search().sameAs == 'false');
                    $scope.tabsData = $scope.tabs = [defaultTabConfig];
                    $scope.currentQuery = angular.copy(defaultTabConfig);
                    $scope.allSamples = samples;
					initForViewType();
                });
            }).error(function(data) {
                msg = getError(data);
                toastr.error(msg, 'Could not get search queries');
            });

			var initForViewType = function() {
			    $scope.page = 1;
			    $scope.newIndex.name = ($location.search().name ? 'Copy_of_' + $location.search().name : "");
			    $scope.newIndex.options = ($location.search().options ? $location.search().options : ($scope.viewType === "text") ?  textDefaultOptions: predDefaultOptions);

		        if ($scope.searchQueries) {
      		        $scope.newIndex.searchQuery = $location.search().searchQuery ? $location.search().searchQuery : $scope.searchQueries[$scope.viewType];
      		        if ($scope.viewType == 'predication') {
          		        $scope.newIndex.analogicalQuery = $location.search().analogicalQuery ? $location.search().analogicalQuery : $scope.searchQueries['analogical'];
      		        }
		        }

                if ($scope.viewType === 'text' && $scope.allSamples) {
                    $scope.samples = $scope.allSamples['text'];
                    $scope.newIndex.stopList = ($location.search().stopList ? $location.search().stopList : undefined);
                    $scope.newIndex.analyzer = ($location.search().analyzer ? $location.search().analyzer : 'org.apache.lucene.analysis.en.EnglishAnalyzer');
					let isLiteralIndex = getAndRemoveOption("-literal_index");
					if (isLiteralIndex != undefined) {
						$scope.newIndex.isLiteralIndex = isLiteralIndex;
					}
                    if (window.editor) {
                        $scope.setQuery($scope.samples['literals']);
                    }
                }
                if ($scope.viewType === 'predication' && $scope.allSamples) {
					SimilarityService.getIndexes()
						.success(function (data) {
							$scope.literalIndexes = ['no-index'].concat(data
								.filter(function(idx) {return idx.type == 'textLiteral' && (idx.status === 'BUILT' || idx.status === 'OUTDATED')})
								.map(function(idx) {return idx.name}));

							if ($scope.newIndex.inputIndex == undefined) {
								let desiredIdx = getAndRemoveOption("-input_index");
								if (desiredIdx != undefined) {
									for (let j = 0; j < $scope.literalIndexes.length; j++) {
										if (desiredIdx == $scope.literalIndexes[j]) {
											$scope.newIndex.inputIndex = $scope.literalIndexes[j];
										}
									}
								}
							}
							if ($scope.newIndex.inputIndex == undefined) {
								$scope.newIndex.inputIndex = $scope.literalIndexes[0]
							}
						})
						.error(function (data, status, headers, config) {
							msg = getError(data);
							toastr.error(msg, 'Could not get indexes');
						});

                    $scope.samples = $scope.allSamples['predication'];
                    if (window.editor) {
                        $scope.setQuery($scope.samples['predication']);
                    }
                }
			};

            $scope.$watch('viewType', function() {
                initForViewType();
            });

			var similarityLocalStorageKey = 'hide-similarity-help';
			$scope.helpHidden = localStorageService.get(similarityLocalStorageKey) === 1;
            $scope.toggleHelp = function(value) {
                if (value === undefined) {
                    value = localStorageService.get(similarityLocalStorageKey);
                }
                if (value !== 1) {
                    localStorageService.set(similarityLocalStorageKey, 1);
                    $scope.helpHidden = true;
                } else {
                    localStorageService.set(similarityLocalStorageKey, 0);
                    $scope.helpHidden = false;
                }
            };
			var filenamePattern = new RegExp('^[a-zA-Z0-9-_]+$');

			$scope.viewQuery = function () {
				if (!validateIndex()) {
					return;
				}

				$http.get("/rest/similarity/query",
					{
						params: {
							name: $scope.newIndex.name,
							options: $scope.newIndex.options,
							selectQuery: $scope.currentQuery.query,
							stopList: $scope.newIndex.stopList,
							infer: $scope.currentQuery.inference,
							sameAs: $scope.currentQuery.sameAs,
							type: $scope.viewType,
							analyzer: $scope.newIndex.analyzer,
						}
					}).success(function (query) {
					if (query) {
						var modal = $modal.open({
							templateUrl: 'pages/viewQuery.html',
							controller: 'ViewQueryCtrl',
							resolve: {
								query: function () {
									return query;
								}
							}
						});
					}
				})

			};

			$scope.$watch('newIndex.name', function () {
				$scope.isInvalidIndexName = false;
				$scope.isEmptyIndexName = false;
			});

			$scope.saveQueries = function() {
                // save the current query
                var query = window.editor.getValue().trim();
                if ($scope.page === 1) {
                    $scope.newIndex.query = query;
                } else if ($scope.page === 2) {
                    $scope.newIndex.searchQuery = query;
                } else if ($scope.page == 3) {
                    $scope.newIndex.analogicalQuery = query;
                }
			};

			$scope.goToPage = function(page) {
			    // ugly fix for GDB-3099
                if (page !== 1 && $scope.viewMode !== 'yasr') {
                    $scope.showEditor();
                    $timeout(function() {
                        if (page === 2) {
                            $scope.currentQuery.query = $scope.newIndex.searchQuery;
                        }
                        if (page === 3) {
                            $scope.currentQuery.query = $scope.newIndex.analogicalQuery;
                        }

                        window.editor.setValue($scope.currentQuery.query);
                    })
                }

                $scope.saveQueries();
                // get the saved query
                if (page === 1) {
                    $scope.currentQuery.query = $scope.newIndex.query;
                } else if (page === 2) {
                    $scope.currentQuery.query = $scope.newIndex.searchQuery;
                } else if (page === 3) {
                    $scope.currentQuery.query = $scope.newIndex.analogicalQuery;
                }
                loadTab($scope.currentQuery.id);
                $scope.notoolbar = page !== 1;

                $scope.page = page;
			};

			$scope.createIndex = function () {
				if (!validateIndex()) {
					return;
				}
				// Check existing indexes
				SimilarityService.getIndexes()
					.success(function (data) {
						data.forEach(function (index) {
							if (index.name === $scope.newIndex.name) {
								$scope.invalidIndexName = "Index with this name already exists.";
							}
						});
						if (!$scope.invalidIndexName) {
							let indexType = $scope.viewType;

							if ($scope.literalIndexes !== undefined) {
								let inputIndex = $scope.newIndex.inputIndex;
								if (inputIndex !== $scope.literalIndexes[0]) {
									appendOption("-input_index", inputIndex)
								}
							}
							if ($scope.newIndex.isLiteralIndex == 'true') {
								appendOption("-literal_index", "true")
								indexType = "textLiteral";
							}

							SimilarityService.createIndex('POST',
							                              $scope.newIndex.name,
							                              $scope.newIndex.options,
							                              $scope.newIndex.query,
							                              $scope.newIndex.searchQuery,
							                              $scope.newIndex.analogicalQuery,
							                              $scope.newIndex.stopList,
							                              $scope.currentQuery.inference,
							                              $scope.currentQuery.sameAs,
							                              indexType,
							                              $scope.newIndex.analyzer).error(function (err) {
								toastr.error(getError(err), "Could not create index")
							})
							$location.path('similarity');
						}

					})
					.error(function (data, status, headers, config) {
						msg = getError(data);
						toastr.error(msg, 'Could not get indexes');
					});

			};

			var appendOption = function (option, value) {
				$scope.newIndex.options = $scope.newIndex.options + ($scope.newIndex.options === '' ? '' : ' ') + option + " " + value
			};

			var validateIndex = function () {
			    $scope.invalidIndexName = false;
			    $scope.saveQueries();
				if (!$scope.newIndex.name) {
					$scope.invalidIndexName = "Index name cannot be empty";
					return false;
				}
				if (!filenamePattern.test($scope.newIndex.name)) {
					$scope.invalidIndexName = 'Index name can contain only letters (a-z, A-Z), numbers (0-9), "-" and "_"';
					return false;
				}

				if (!$scope.newIndex.query) {
					toastr.error('Select query cannot be empty.');
					return false;
				}

                if (!$scope.newIndex.searchQuery) {
                    toastr.error('Search query cannot be empty.');
                    return false;
                }

                if ($scope.viewType == 'predication' && !$scope.newIndex.analogicalQuery) {
                    toastr.error('Analogical query cannot be empty.');
                    return false;
                }

                if (window.editor.getQueryType() !== 'SELECT') {
                    toastr.error('Similarity index requires SELECT queries.');
                    return;
                }

				return true;
			};

            // Called when user clicks on a sample query
            $scope.setQuery = function(query) {
                // Hack for YASQE bug
                window.editor.setValue(query ? query : " ");
            };

			// TODO don't copy paste each time, this is the same as in the graph config
			// DOWN HERE WE KEEP EVERYTHING PURELY QUERY EDITOR (MOSTLY BORROWED FROM query-editor.controller.js)

			$scope.showEditor = function () {
				if (window.editor.xhr) {
					window.editor.xhr.abort();
				}
				$scope.viewMode = 'yasr';
			};

			$scope.showPreview = function () {
				// For some reason YASR gets confused and sets this to rawResponse
				// if we execute a CONSTRUCT and then a SELECT. This makes sure it's always table.
				$scope.currentQuery.outputType = 'table';
				$scope.runQuery();
			};

			var defaultTabConfig = {
				id: "1",
				name: '',
				query: '',
				inference: true,
				sameAs: true
			};


			$scope.resetCurrentTabConfig = function () {
				$scope.currentTabConfig = {
					pageSize: 100, // page limit 100 as this is only used for preview
					page: 1,
					allResultsCount: 0,
					resultsCount: 0
				};
			};

			$scope.queryExists = false;

			$scope.resetCurrentTabConfig();

			$scope.tabsData = $scope.tabs = [defaultTabConfig];

			// query tab operations
			$scope.saveTab = saveTab;
			$scope.loadTab = loadTab;
			$scope.addNewTab = addNewTab;

			// query operations
			$scope.runQuery = runQuery;
			$scope.getNamespaces = getNamespaces;
			$scope.changePagination = changePagination;
			$scope.toggleSampleQueries = toggleSampleQueries;
			$scope.addKnownPrefixes = addKnownPrefixes;
			$scope.getExistingTabId = getExistingTabId;
			$scope.querySelected = querySelected;
			$scope.saveQueryToLocal = saveQueryToLocal;

			$scope.setLoader = setLoader;
			$scope.getLoaderMessage = getLoaderMessage;

			// query editor and results orientation
			$scope.fixSizesOnHorizontalViewModeSwitch = fixSizesOnHorizontalViewModeSwitch;
			$scope.changeViewMode = changeViewMode;
			$scope.showHideEditor = showHideEditor;
			$scope.focusQueryEditor = focusQueryEditor;
			$scope.orientationViewMode = true;

			// start of repository actions
			backendRepositoryID = $scope.getActiveRepository();

			function getAndRemoveOption(key) {
				let optArr = $scope.newIndex.options.split(" ");
				for (let i = 0; i < optArr.length; i++) {
					if (optArr[i] == key && i + 1 < optArr.length) {
						let value = optArr[i + 1];

						delete optArr[i];
						delete optArr[i + 1];
						$scope.newIndex.options = optArr.join(" ");

						return value;
					}
				}
				return undefined;
			}

			function saveQueryToLocal(currentQueryTab) {
			}

			function setLoader(isRunning, progressMessage, extraMessage) {
				var yasrInnerContainer = angular.element(document.getElementById("yasr-inner"));
				$scope.queryIsRunning = isRunning;
				if (isRunning) {
					$scope.queryStartTime = Date.now();
					$scope.countTimeouted = false;
					$scope.progressMessage = progressMessage;
					$scope.extraMessage = extraMessage;
					yasrInnerContainer.addClass("hide");
				} else {
					$scope.progressMessage = "";
					$scope.extraMessage = "";
					yasrInnerContainer.removeClass("hide");
				}
				// We might call this from angular or outside angular so take care of applying the scope.
				if ($scope.$$phase === null) {
					$scope.$apply();
				}
			}

			function getLoaderMessage() {
				var timeSeconds = (Date.now() - $scope.queryStartTime) / 1000,
					timeHuman = $scope.getHumanReadableSeconds(timeSeconds),
					message = "";

				if ($scope.progressMessage) {
					message = $scope.progressMessage + "... " + timeHuman;
				} else {
					message = "Running operation..." + timeHuman;
				}
				if ($scope.extraMessage && timeSeconds > 10) {
					message += "\n" + $scope.extraMessage;
				}

				return message;
			}


			// start of query editor results orientation operations
			function fixSizesOnHorizontalViewModeSwitch(verticalView) {
				function visibleWindowHeight() {
					return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
				}

				var verticalView = verticalView;
				if (!$scope.orientationViewMode) {
					$scope.noPadding = {paddingRight: 15, paddingLeft: 0};

					// window.editor is undefined if no repo is selected
					if (window.editor && document.querySelector('.CodeMirror-wrap')) {
						var newHeight = visibleWindowHeight() - (document.querySelector('.CodeMirror-wrap').getBoundingClientRect().top);
						newHeight -= 40;
						document.querySelector('.CodeMirror-wrap').style.height = newHeight + 'px';
						document.getElementById('yasr').style.minHeight = newHeight + 'px';
						//window.editor.refresh();
					} else {
						if (verticalView) {
							var timer = $timeout(function () {
								$scope.fixSizesOnHorizontalViewModeSwitch(verticalView)
							}, 100);
						} else {
							var timer = $timeout($scope.fixSizesOnHorizontalViewModeSwitch, 100);
						}

						$scope.$on("$destroy", function (event) {
							$timeout.cancel(timer);
						});
					}
				} else {
					if ($scope.viewMode === 'yasr') {
						var newHeight = visibleWindowHeight() - (document.querySelector('.CodeMirror-wrap').getBoundingClientRect().top);
						newHeight -= 40;
						document.querySelector('.CodeMirror-wrap').style.height = newHeight + 'px';
						//window.editor.refresh();
					} else {
						$scope.noPadding = {};
						document.querySelector('.CodeMirror-wrap').style.height = '';
						//window.editor.refresh();
					}
					document.getElementById('yasr').style.minHeight = '';
				}
				if (window.yasr && window.yasr.container) {
					$timeout(function () {
						window.yasr.container.resize();
					}, 100);
				}
			}

			if (!$scope.orientationViewMode) {
				showHideEditor();
			}


			function changeViewMode(tabID) {
				$scope.viewMode = 'none';
				$scope.orientationViewMode = !$scope.orientationViewMode;
				// localStorageService.set('viewMode', $scope.orientationViewMode);
				fixSizesOnHorizontalViewModeSwitch();
				$('.dataTables_filter').remove();
				$('.resultsTable').remove();
				$timeout(function () {
					loadTab(tabID);
					selectTab(tabID);
				}, 100);
			}

			function showHideEditor() {
				fixSizesOnHorizontalViewModeSwitch(true);
			}

			function focusQueryEditor() {
				if (!angular.element(document).find('.editable-input').is(":focus")) {
					angular.element(document).find('.CodeMirror textarea:first-child').focus();
				}
			}

			// end of query editor results orientation operations

			function deleteCachedSparqlResults() {
			}

			function selectTab(id) {
				$timeout(function () {
					$('a[data-id = "' + id + '"]').tab('show');
				}, 0);
			}

			// start of query operations
			function runQuery(changePage, explain) {
				$scope.executedQueryTab = $scope.currentQuery;
				if (window.editor.getQueryType() !== 'SELECT') {
				    toastr.error('Similarity indexes work only with SELECT queries.');
                    return;
				}
				if (explain && !(window.editor.getQueryType() === 'SELECT')) {
					toastr.warning('Explain only works with SELECT queries.');
					return;
				}

				if (window.editor.getQueryMode() === 'update') {
					toastr.warning('Cannot execute updates from this editor.');
					return;
				}

				$scope.explainRequested = explain;
				if (!$scope.queryIsRunning) {
					if (changePage) {
						$scope.currentTabConfig.resultsCount = 0;
					} else {
						$scope.resetCurrentTabConfig();
					}

					// Hides the editor and shows the yasr results
					$scope.viewMode = 'editor';
					if ($scope.orientationViewMode) {
						$scope.fixSizesOnHorizontalViewModeSwitch()
					}

					setLoader(true, 'Evaluating query');
					window.editor.query();
				}
			}

			function getNamespaces() {
				// Signals the namespaces are to be fetched => loader will be shown
				setLoader(true, 'Refreshing namespaces', 'Normally this is a fast operation but it may take longer if a bigger repository needs to be initialised first.');
				// $scope.queryIsRunning = true;
				////console.log("Send namespaces request. Default token is : " + $http.defaults.headers.common["Authorization"]);
				SparqlService.getRepositoryNamespaces()
					.success(function (data) {
						var usedPrefixes = {};
						data.results.bindings.forEach(function (e) {
							usedPrefixes[e.prefix.value] = e.namespace.value;
						});
						$scope.namespaces = usedPrefixes;
					})
					.error(function (data) {
						$scope.repositoryError = getError(data);
					})
					.finally(function () {
						// Signals namespaces were fetched => loader will be hidden
						setLoader(false);
					});
			}

			function changePagination() {
				runQuery(true, $scope.explainRequested);
			}

			if ($scope.getActiveRepository()) {
				getNamespaces();
			}

			$scope.$on("$destroy", function (event) {
				window.editor = null;
				window.yasr = null;
			});

			function toggleSampleQueries() {
			}

			// Add known prefixes
			function addKnownPrefixes() {
				SparqlService.addKnownPrefixes(JSON.stringify(window.editor.getValue()))
					.success(function (data, status, headers, config) {
						if (angular.isDefined(window.editor) && angular.isDefined(data) && data !== window.editor.getValue()) {
							window.editor.setValue(data);
						}
					})
					.error(function (data, status, headers, config) {
						var msg = getError(data);
						toastr.error(msg, 'Error! Could not add known prefixes');
						return true;
					});
			}

			$('textarea').on('paste', function () {
				$timeout(function () {
					addKnownPrefixes();
				}, 0);
			});

			function querySelected(query) {
				var tabId = getExistingTabId(query);
				$scope.toggleSampleQueries();
				if (!angular.isDefined(tabId)) {
					$scope.addNewTab(null, query.name, query.body);
				} else {
					selectTab(tabId);
				}
			}

			function getExistingTabId(query) {
				var existingTabId = undefined;
				angular.forEach($scope.tabsData, function (item, index) {
					if (item.name === query.name && item.query === query.body) {
						existingTabId = item.id;
						return item;
					}
				});

				return existingTabId;
			}


			// end of query operations

			// start of query tab operations
			function findTabIndexByID(id) {
				for (var i = 0; i < $scope.tabsData.length; i++) {
					var tab = $scope.tabsData[i];
					if (tab.id === id) {
						return i;
					}
				}
			}

			$scope.$watchCollection('[currentQuery.inference, currentQuery.sameAs]', function () {
				saveQueryToLocal($scope.currentQuery);
			});

			function saveTab(id) {
				var idx = findTabIndexByID(id);
				// Tab was deleted, don't try to save it's state
				if (idx === undefined) {
					return {};
				}
				var tab = $scope.tabsData[idx];
				//tab.query = window.editor.getValue();
				$scope.saveQueryToLocal(tab);
				return tab;
			}

			var maxID = 1;

			function addNewTab(callback, tabName, savedQuery) {
			}

			function loadTab(id) {
				$scope.tabsData = [$scope.currentQuery];

				tab = $scope.currentQuery;

				if ($scope.currentQuery.query == null || $scope.currentQuery.query == "") {
					// hack for YASQE bug
					window.editor.setValue(" ");
				} else {
					window.editor.setValue($scope.currentQuery.query);
				}

				$timeout(function () {
					$scope.currentTabConfig = {};
					$scope.currentTabConfig.queryType = tab.queryType;
					$scope.currentTabConfig.resultsCount = tab.resultsCount;

					$scope.currentTabConfig.offset = tab.offset;
					$scope.currentTabConfig.allResultsCount = tab.allResultsCount;
					$scope.currentTabConfig.page = tab.page;
					$scope.currentTabConfig.pageSize = tab.pageSize;

					$scope.currentTabConfig.timeFinished = tab.timeFinished;
					$scope.currentTabConfig.timeTook = tab.timeTook;
					$scope.currentTabConfig.sizeDelta = tab.sizeDelta;
					$scope.$apply();
				}, 0);

				//Remove paddign of yasr so it will be aligned with sparql editor
				$('#yasr').css('padding', '0');
			}

			function getQueryID(element) {
				return $(element).attr('data-id');
			}

			$scope.$on('tabAction', function (e, tabEvent) {
				if (tabEvent.relatedTarget) {
					$scope.saveTab(getQueryID(tabEvent.relatedTarget));
				}
				$scope.loadTab(getQueryID(tabEvent.target));
			});

			$scope.$on('deleteAllexeptSelected', function (e, tabs) {
				$scope.tabsData = tabs;
				$scope.tabs = tabs;
			});
			// end of query tab operations

			$scope.currentQuery = angular.copy(defaultTabConfig);
			// $scope.state = {};
			$scope.showSampleQueries = false;
			$scope.savedQuery = {};
			$scope.sampleQueries = {};

			$scope.getResultsDescription = function () {
			};

			$scope.getUpdateDescription = function () {
			};

			$scope.getStaleWarningMessage = function () {
			}

		}
	});