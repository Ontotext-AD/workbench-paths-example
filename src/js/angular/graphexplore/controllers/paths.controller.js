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
        }
    }
);
