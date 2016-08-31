'use strict'

var gulp = require('gulp');
var livereload = require('gulp-livereload');
var spawn = require('child_process').spawn;
var shell = require('shelljs');

var node;
var _node;

var p_json = require('./package.json');

gulp.task('serve:icws', function () {
    if (node) { node.kill(); }

    node = spawn('node', ['index.js'], { stdio: 'inherit' });

    node.on('close', function (code) {
        if (code === 8) {
            gulp.log('Error detected, waiting for changes...');
        }
    });
});

gulp.task('reload', function () {
    livereload.reload();
});

gulp.task('watch', function () {
    // gulp.watch(['./www/**'], ['reload']);
    // gulp.watch(['./controllers/**', './libs/**'], ['serve:icws']);
});

gulp.task('serve:middlehand', function () {
    if (_node) { _node.kill(); }

    _node = spawn('node', ['middlehand/server.js'], { stdio: 'inherit' });

    _node.on('close', function (code) {
        if (code === 8) {
            gulp.log('Error detected, waiting for changes...');
        }
    });
});

gulp.task('build:middlehand', function () {
    shell.exec('npm run build:modules');
});

gulp.task('watch:middlehand', function () {
    livereload.listen();
    gulp.watch(['./middlehand/**', '!./middlehand/www'], ['serve:middlehand']);
    gulp.watch(['./middlehand/www/**', '!./middlehand/www/.bin'], ['build:middlehand', 'reload']);
});

gulp.task('middlehand', ['build:middlehand', 'watch:middlehand', 'serve:middlehand']);

gulp.task('default', ['watch', 'serve:icws', 'reload']);
