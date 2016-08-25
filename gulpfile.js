'use strict'

var gulp = require('gulp');
var livereload = require('gulp-livereload');
var spawn = require('child_process').spawn;
var shell = require('shelljs');

var node;

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
    livereload.listen();
    gulp.watch(['./www/**'], ['reload']);
    // gulp.watch(['./controllers/**', './libs/**'], ['serve:icws']);
});

gulp.task('default', ['watch', 'serve:icws', 'reload']);
