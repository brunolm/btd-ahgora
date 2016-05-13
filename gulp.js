const gulp = require('gulp');
const shell = require('gulp-shell');
const rimraf = require('rimraf');

gulp.task('build', shell.task('tsc'));
gulp.task('build-watch', shell.task('tsc -w'));
gulp.task('clean', () => rimraf('built', {}, () => {}));
