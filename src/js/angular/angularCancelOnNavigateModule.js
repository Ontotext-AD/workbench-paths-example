/**
 * angular-cancel-on-navigate - AngularJS module that cancels HTTP requests on location change (navigation)
 * @version v0.1.0
 * @link https://github.com/AlbertBrand/angular-cancel-on-navigate
 * @license MIT
 *
 * ONTO: This helps with keeping the angular ajax pool under control when a big repo is being initialized
 * and an impatient user is clicking around the Workbench.
 */
angular
  .module('angularCancelOnNavigateModule', [])
  .config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push('HttpRequestTimeoutInterceptor');
  }])
  .run(['$rootScope', 'HttpPendingRequestsService', function ($rootScope, HttpPendingRequestsService) {
    $rootScope.$on('$locationChangeSuccess', function (event, newUrl, oldUrl) {
      var newUrlObj = new URL(newUrl);
      var oldUrlObj = new URL(oldUrl);
      // cancel only if the URLs have different origin (proto + host + port) or pathname but not different hash
      if (newUrlObj.origin !== oldUrlObj.origin || newUrlObj.pathname !== oldUrlObj.pathname) {
        HttpPendingRequestsService.cancelAll();
      }
    })
  }]);

angular.module('angularCancelOnNavigateModule')
  .service('HttpPendingRequestsService', ['$q', function ($q) {
    var cancelPromises = [];

    function newTimeout() {
      var cancelPromise = $q.defer();
      cancelPromises.push(cancelPromise);
      return cancelPromise.promise;
    }

    function cancelAll() {
      angular.forEach(cancelPromises, function (cancelPromise) {
        cancelPromise.promise.isGloballyCancelled = true;
        cancelPromise.resolve();
      });
      cancelPromises.length = 0;
    }

    return {
      newTimeout: newTimeout,
      cancelAll: cancelAll
    };
  }]);

angular.module('angularCancelOnNavigateModule')
  .factory('HttpRequestTimeoutInterceptor', ['$q', 'HttpPendingRequestsService', function ($q, HttpPendingRequestsService) {
    return {
      request: function (config) {
        config = config || {};
        if (config.timeout === undefined && !config.noCancelOnRouteChange) {
          config.timeout = HttpPendingRequestsService.newTimeout();
        }
        return config;
      },

      responseError: function (response) {
        if (response.config.timeout && response.config.timeout.isGloballyCancelled) {
          return $q.defer().promise;
        }
        return $q.reject(response);
      }
    };
  }]);
