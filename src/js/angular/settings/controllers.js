define(['angular/core/services', 'angular/security/services'],
    function () {

        angular
            .module('graphdb.framework.settings.controllers', [
                'ngCookies',
                'ui.bootstrap',
                'graphdb.framework.security.services',
                'toastr'
            ])
            .controller('ActiveLocationSettingsCtrl', ActiveLocationSettingsCtrl)
            .controller('ValidateLicenseModalCtrl', ValidateLicenseModalCtrl)
            .controller('LicenseCtrl', LicenseCtrl)
            .controller('RegisterLicenseCtrl', RegisterLicenseCtrl)
            .controller('LoaderSamplesCtrl', LoaderSamplesCtrl);

        ActiveLocationSettingsCtrl.$inject = ['$scope', '$http', 'toastr', '$modalInstance'];
        function ActiveLocationSettingsCtrl($scope, $http, toastr, $modalInstance) {
            $scope.settings = {statistics: false};
            $scope.supportsStatistics = true;
            $scope.getSettings = getSettings;

            function getSettings() {
                $scope.loader = true;
                $http.get('rest/graphdb-settings/statistics').then(function (response) {
                    $scope.settings.statistics = response.data === 'true';
                    $scope.supportsStatistics = true;
                }, function (response) {
                    if (response.status == 404) {
                        $scope.supportsStatistics = false;
                    } else {
                        var msg = getError(response.data);
                        toastr.error(msg, 'Error getting settings');
                    }
                });
            }

            $scope.getSettings();

            $scope.setSettings = function () {
                $scope.loader = true;
                $http({
                    method: 'POST',
                    url: 'rest/graphdb-settings/statistics',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    data: 'enabled=' + $scope.settings.statistics
                })
                    .then(function (response) {
                        $modalInstance.close();
                        toastr.success('Settings have been saved');
                    }, function (response) {
                        var msg = getError(response.data);
                        toastr.error(msg, 'Error saving settings')
                    });
            }

            $scope.submitForm = function () {
                $scope.setSettings();
            }

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
            };

        }

        LicenseCtrl.$inject = ['$scope', '$http', '$location', '$cookieStore', 'LicenseService', 'toastr', '$rootScope'];
        function LicenseCtrl($scope, $http, $location, $cookieStore, LicenseService, toastr, $rootScope) {
            $scope.loader = true;

            LicenseService.checkLicenseHardcoded()
                .success(function (res) {
                    $rootScope.isLicenseHardcoded = (res === "true");
                })
                .error(function () {
                    $rootScope.isLicenseHardcoded = false;
                    toastr.error("Error checking license availability")
                })
                .then(function () {
                    LicenseService.getLicenseInfo()
                        .success(function (res) {
                            $scope.loader = false;
                            $scope.license = res;
                            // check if you have a hardcoded license that is not activated through the workbench and if
                            // you do disable ability to update license
                        })
                        .error(function (res) {
                            // no license but we need to check for 417
                            $scope.loader = false;
                            $scope.license = {message: "No license was set.", valid: false};
                            //$location.path("license/register");
                        });
                })
        }

        RegisterLicenseCtrl.$inject = ['$scope', 'LicenseService', '$location', '$modal', 'toastr', '$window', '$jwtAuth'];
        function RegisterLicenseCtrl($scope, LicenseService, $location, $modal, toastr, $window, $jwtAuth) {
            $scope.$on('securityInit', function (scope, securityEnabled, userLoggedIn, freeAccess) {
                if (!$jwtAuth.hasRole('ROLE_ADMIN')) {
                    $location.path('/license');
                }
            });

            $scope.sendLicenseToValidateAndActivate = sendLicenseToValidateAndActivate;

            var textAreaSel = $(".license-textarea");

            // watch for uploaded license file
            $scope.$watch('currentFile', function () {
                if ($scope.currentFile) {
                    var file = $scope.currentFile;
                    LicenseService.extractFromLicenseFile(file)
                        .success(function (licenseCode, status, headers, config) {
                            sendLicenseToValidateAndActivate(licenseCode);
                        }).error(function (data, status, headers, config) {
                        toastr.error("Could not upload file");
                    });
                }
            });

            $scope.getBackToPreviousPage = function () {
                $window.history.back();
            }

            // send license code for validation and activation
            function sendLicenseToValidateAndActivate(licenseCode) {
                LicenseService.sendLicenseToValidate(licenseCode)
                    .success(function (validatedLicense) {
                        if (validatedLicense.licensee !== "Invalid") {
                            // write code to textarea
                            textAreaSel.val(licenseCode);
                            // pop dialog for license details confirmation
                            confirmWantedNewLicenseDetails(validatedLicense, licenseCode);
                        } else {
                            // clear textarea on invalid license
                            textAreaSel.val("");
                            // show error
                            toastr.error(validatedLicense.message);
                        }
                    })
                    .error(function () {
                        toastr.error("Invalid license");
                    });
            }


            // pops a modal dialog which asks you if your expected license details are correct
            // and sends license to GraphDB upon confirmation
            function confirmWantedNewLicenseDetails(license, licenseCode) {
                var modalInstance = $modal.open({
                    templateUrl: 'js/angular/settings/modal/validate-license.html',
                    controller: 'ValidateLicenseModalCtrl',
                    resolve: {
                        license: function () {
                            return license;
                        }
                    }
                });

                modalInstance.result.then(function () {
                    registerLicense(licenseCode);
                });
            }

            // send license code to GraphDB for activation
            function registerLicense(licenseCode) {
                if (!licenseCode) {
                    licenseCode = textAreaSel.val();
                }

                if (licenseCode) {
                    // replacing whitespace makes this work on Safari too,
                    // whereas other browser happily ignore the whitespace
                    var decodedLicense = atob(licenseCode.replace(/\s/g, ""));
                    LicenseService.registerLicense(decodedLicense)
                        .success(function (data, status, headers, config) {
                            $window.history.back();
                            // $location.path("license");
                        }).error(function (data, status, headers, config) {
                        toastr.error("Error registering GraphDB license");
                    });
                } else {
                    toastr.error("No license code available in textarea");
                }
            }
        }

        ValidateLicenseModalCtrl.$inject = ['$scope', '$modalInstance', 'license'];
        function ValidateLicenseModalCtrl($scope, $modalInstance, license) {
            $scope.ok = ok;
            $scope.cancel = cancel;
            $scope.license = license;

            function ok() {
                $modalInstance.close();
            }

            function cancel() {
                $modalInstance.dismiss('cancel');
            }
        }

        LoaderSamplesCtrl.$inject = ['$scope'];
        function LoaderSamplesCtrl($scope) {
            $scope.loader = true;
            $scope.setLoader = function (loader) {
                $scope.loader = loader;
            }
        }
    })
;
