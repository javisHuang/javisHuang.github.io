// dialogService.js

// 创建一个名为dialogService的AngularJS模块
var app = angular.module('dialogService', []);

// 在dialogService模块中定义一个名为dialogService的服务
app.service('dialogService', ['$document', '$compile', '$rootScope', function ($document, $compile, $rootScope) {
    this.showAlert = function (message) {
        // 创建一个新的scope
        var scope = $rootScope.$new();

        // 设置对话框的内容
        scope.message = message;

        // 编译对话框模板
        var template = '<div class="custom-modal">' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '<h3 class="modal-title">警告</h3>' +
            '</div>' +
            '<div class="modal-body">{{ message }}</div>' +
            '<div class="modal-footer">' +
            '<button class="btn btn-primary" ng-click="close()">确定</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        var element = $compile(template)(scope);

        // 将对话框添加到DOM中
        $document.find('body').append(element);

        // 定义关闭对话框的函数
        scope.close = function () {
            element.remove();
            scope.$destroy();
        };
    };
}]);
