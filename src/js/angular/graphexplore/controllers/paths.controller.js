define([
        'angular/core/services',
        'lib/common/d3-utils'
    ],
    function (require, D3) {
        angular
            .module('graphdb.framework.graphexplore.controllers.paths', [
                'toastr',
                'ui.bootstrap',
            ])
            .controller('GraphPathsCtrl', GraphPathsCtrl);

        GraphPathsCtrl.$inject = ["$scope", "$rootScope", "$repositories", "toastr", "$timeout", "$http", "ClassInstanceDetailsService", "AutocompleteService", "$q", "$location"];

        function GraphPathsCtrl($scope, $rootScope, $repositories, toastr, $timeout, $http, ClassInstanceDetailsService, AutocompleteService, $q, $location) {

            $scope.getActiveRepository = function () {
                return $repositories.getActiveRepository();
            };

            $scope.isLoadingLocation = function () {
                return $repositories.isLoadingLocation();
            };

            $scope.hasActiveLocation = function () {
                return $repositories.hasActiveLocation();
            };

            function initForRepository() {
                if (!$repositories.getActiveRepository()) {
                    return;
                }
                $scope.getNamespacesPromise = ClassInstanceDetailsService.getNamespaces($scope.getActiveRepository());
                $scope.getAutocompletePromise = AutocompleteService.checkAutocompleteStatus();
            }

            $scope.$on('repositoryIsSet', function(event, args) {
                initForRepository();
            });
            initForRepository();

            var maxPathLength = 3;

            var findPath = function (startNode, endNode, visited, path) {
                // A path is found, return a promise that resolves to it
                if (startNode === endNode) {
                    return $q.when(path)
                }
                // Find only paths with maxLength, we want to cut only short paths between airports
                if (path.length === maxPathLength) {
                    return $q.when([])
                }
                return $http({
                    url: 'rest/explore-graph/links',
                    method: 'GET',
                    params: {
                        iri: startNode,
                        config: 'default',
                        linksLimit: 50
                    }
                }).then(function (response) {
                    // Use only links with the hasFlightTo predicate
                    var flights = _.filter(response.data, function(r) {return r.predicates[0] == "hasFlightTo"});
                    // For each links, continue to search path recursively
                    var promises = _.map(flights, function (link) {
                        var o = link.target;
                        if (!visited.includes(o)) {
                            return findPath(o, endNode, visited.concat(o), path.concat(link));
                        }
                        return $q.when([]);
                    });
                    // Group together all promises that resolve to paths
                    return $q.all(promises);
                }, function (response) {
                    var msg = getError(response.data);
                    toastr.error(msg, 'Error looking for path node');
                });
            }

            $scope.findPath = function (startNode, endNode) {
                findPath(startNode, endNode, [startNode], []).then(function (linksFound) {
                    console.log(_.flattenDeep(linksFound));
                    //renderGraph(_.flattenDeep(linksFound));
                });
            }
        }
    }
);
