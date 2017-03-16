'use strict';

// Подключим зависимости
const fs = require('fs');
const gulp = require('gulp');
const gulpSequence = require('gulp-sequence');
const browserSync = require('browser-sync').create();

const postcss = require('gulp-postcss');
const autoprefixer = require("autoprefixer")
const mqpacker = require("css-mqpacker")
const cleanss = require('gulp-cleancss');

const plumber = require('gulp-plumber');
const notify = require('gulp-notify');
const gulpIf = require('gulp-if');
const debug = require('gulp-debug');
const rename = require('gulp-rename');
const size = require('gulp-size');
const del = require('del');
const newer = require('gulp-newer');

// Получим настройки проекта из package.json
let pjson = require('./package.json');
let dirs = pjson.configProject.dirs;
let lists = getFilesList(pjson.configProject);
// console.log('---------- Файлы и папки, взятые в работу:');
console.log(lists);

// Запишем стилевой файл диспетчер подключений
let styleImports = '/**\n * ВНИМАНИЕ! Этот файл генерируется автоматически.\n * Не пишите сюда ничего вручную, все такие правки будут потеряны.\n * Читайте ./README.md для понимания.\n */\n\n';
lists.css.forEach(function(blockPath) {
  styleImports += '@import "'+blockPath+'";\n';
});
fs.writeFileSync('./src/scss/style.scss', styleImports);

// Определим разработка это или финальная сборка
// Запуск `NODE_ENV=production npm start [задача]` приведет к сборке без sourcemaps
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV == 'dev';

// Плагины postCSS, которыми обрабатываются все стилевые файлы
let postCssPlugins = [
  autoprefixer({browsers: ['last 2 version']}),
  mqpacker({
    sort: true
  }),
];

// Очистка папки сборки
gulp.task('clean', function () {
  console.log('---------- Очистка папки сборки');
  return del([
    dirs.buildPath + '/**/*',
    '!' + dirs.buildPath + '/readme.md'
  ]);
});

// Компиляция стилей
gulp.task('style', function () {
  const sass = require('gulp-sass');
  const sourcemaps = require('gulp-sourcemaps');
  console.log('---------- Компиляция стилей');
  return gulp.src(dirs.srcPath + 'scss/style.scss')
    .pipe(plumber({
      errorHandler: function(err) {
        notify.onError({
          title: 'Styles compilation error',
          message: err.message
        })(err);
        this.emit('end');
      }
    }))
    .pipe(gulpIf(isDev, sourcemaps.init()))
    .pipe(debug({title: "Style:"}))
    .pipe(sass())
    .pipe(postcss(postCssPlugins))
    .pipe(gulpIf(!isDev, cleanss()))
    .pipe(rename('style.min.css'))
    .pipe(gulpIf(isDev, sourcemaps.write('/')))
    .pipe(size({
      title: 'Размер',
      showFiles: true,
      showTotal: false,
    }))
    .pipe(gulp.dest(dirs.buildPath + '/css'))
    .pipe(browserSync.stream({match: '**/*.css'}));
});

// Копирование добавочных CSS, которые хочется иметь отдельными файлами
gulp.task('copy:css', function() {
  return gulp.src(pjson.configProject.copiedCss)
    .pipe(postcss(postCssPlugins))
    .pipe(cleanss())
    .pipe(size({
      title: 'Размер',
      showFiles: true,
      showTotal: false,
    }))
    .pipe(gulp.dest(dirs.buildPath + '/css'))
    .pipe(browserSync.stream());
});

// Копирование изображений
gulp.task('copy:img', function () {
  console.log('---------- Копирование изображений');
  return gulp.src(lists.img)
    .pipe(newer(dirs.buildPath + '/img'))  // оставить в потоке только изменившиеся файлы
    .pipe(size({
      title: 'Размер',
      showFiles: true,
      showTotal: false,
    }))
    .pipe(gulp.dest(dirs.buildPath + '/img'));
});

// Копирование JS
gulp.task('copy:js', function () {
  console.log('---------- Копирование отдельных JS-файлов');
  return gulp.src(pjson.configProject.copiedJs)
    .pipe(size({
      title: 'Размер',
      showFiles: true,
      showTotal: false,
    }))
    .pipe(gulp.dest(dirs.buildPath + '/js'));
});

// Копирование шрифтов
gulp.task('copy:fonts', function () {
  console.log('---------- Копирование шрифтов');
  return gulp.src(dirs.srcPath + '/fonts/*.{ttf,woff,woff2,eot,svg}')
    .pipe(newer(dirs.buildPath + '/fonts'))  // оставить в потоке только изменившиеся файлы
    .pipe(size({
      title: 'Размер',
      showFiles: true,
      showTotal: false,
    }))
    .pipe(gulp.dest(dirs.buildPath + '/fonts'));
});

// Сборка SVG-спрайта для блока sprite-svg
let spritePath = dirs.srcPath + dirs.blocksDirName + '/sprite-svg/svg/';
gulp.task('sprite:svg', function (callback) {
  const svgstore = require('gulp-svgstore');
  const svgmin = require('gulp-svgmin');
  const cheerio = require('gulp-cheerio');
  if(fileExist(spritePath) !== false) {
    console.log('---------- Сборка SVG спрайта');
    return gulp.src(spritePath + '*.svg')
      .pipe(svgmin(function (file) {
        return {
          plugins: [{
            cleanupIDs: {
              minify: true
            }
          }]
        }
      }))
      .pipe(svgstore({ inlineSvg: true }))
      .pipe(cheerio(function ($) {
        $('svg').attr('style',  'display:none');
      }))
      .pipe(rename('sprite-svg.svg'))
      .pipe(size({
        title: 'Размер',
        showFiles: true,
        showTotal: false,
      }))
      .pipe(gulp.dest(dirs.srcPath + dirs.blocksDirName + '/sprite-svg/img/'));
  }
  else {
    console.log('---------- Сборка SVG спрайта: нет папки с картинками');
    callback();
  }
});

// Сборка HTML
gulp.task('html', function() {
  const fileinclude = require('gulp-file-include');
  const replace = require('gulp-replace');
  console.log('---------- сборка HTML');
  return gulp.src(dirs.srcPath + '/*.html')
    .pipe(fileinclude({
      prefix: '@@',
      basepath: '@file',
      indent: true,
    }))
    .pipe(replace(/\n\s*<!--DEV[\s\S]+?-->/gm, ''))
    .pipe(gulp.dest(dirs.buildPath));
});

// Конкатенация и углификация Javascript
gulp.task('js', function (callback) {
  const uglify = require('gulp-uglify');
  const concat = require('gulp-concat');
  if(lists.js.length > 0){
    console.log('---------- Обработка JS');
    return gulp.src(lists.js)
      .pipe(plumber({
        errorHandler: function(err) {
          notify.onError({
            title: 'Javascript concat/uglify error',
            message: err.message
          })(err);
          this.emit('end');
        }
      }))
      .pipe(concat('script.min.js'))
      .pipe(gulpIf(!isDev, uglify()))
      .pipe(size({
        title: 'Размер',
        showFiles: true,
        showTotal: false,
      }))
      .pipe(gulp.dest(dirs.buildPath + '/js'));
  }
  else {
    console.log('---------- Обработка JS: в сборке нет JS-файлов');
    callback();
  }
});

// Оптимизация изображений // folder=src/img npm start img:opt
const folder = process.env.folder;
gulp.task('img:opt', function (callback) {
  const imagemin = require('gulp-imagemin');
  const pngquant = require('imagemin-pngquant');
  if(folder){
    console.log('---------- Оптимизация картинок');
    return gulp.src(folder + '/*.{jpg,jpeg,gif,png,svg}')
      .pipe(imagemin({
          progressive: true,
          svgoPlugins: [{removeViewBox: false}],
          use: [pngquant()]
      }))
      .pipe(gulp.dest(folder));
  }
  else {
    console.log('---------- Оптимизация картинок: ошибка (не указана папка)');
    console.log('---------- Пример вызова команды: folder=src/blocks/block-name/img npm start img:opt');
    callback();
  }
});

// Сборка всего
gulp.task('build', function (callback) {
  gulpSequence(
    'clean',
    'sprite:svg',
    ['style', 'js', 'copy:css', 'copy:img', 'copy:js', 'copy:fonts'],
    'html',
    callback);
});

// Отправка в GH pages (ветку gh-pages репозитория)
gulp.task('deploy', function() {
  const ghPages = require('gulp-gh-pages');
  console.log('---------- Публикация содержимого ./build/ на GH pages');
  return gulp.src(dirs.buildPath + '**/*')
    .pipe(ghPages());
});

// Задача по умолчанию
gulp.task('default', ['serve']);

// Локальный сервер, слежение
gulp.task('serve', ['build'], function() {
  browserSync.init({
    server: dirs.buildPath,
    startPath: 'index.html',
    open: false,
  });
  // Слежение за стилями
  gulp.watch([
    dirs.srcPath + dirs.blocksDirName + '/**/*.scss',
    dirs.srcPath + '/scss/**/*.scss',
  ], ['style']);
  // Слежение за добавочными стилями
  if(pjson.configProject.copiedCss.length) {
    gulp.watch(pjson.configProject.copiedCss, ['copy:css']);
  }
  // Слежение за изображениями
  if(lists.img.length) {
    gulp.watch(lists.img, ['watch:img']);
  }
  // Слежение за добавочными JS
  if(pjson.configProject.copiedJs.length) {
    gulp.watch(pjson.configProject.copiedJs, ['watch:copied:js']);
  }
  // Слежение за шрифтами
  gulp.watch(dirs.srcPath + '/fonts/*.{ttf,woff,woff2,eot,svg}', ['watch:fonts']);
  // Слежение за SVG для спрайта
  if(fileExist(spritePath) !== false) {
    gulp.watch(spritePath + '*.svg', ['watch:svg:sprite']);
  }
  // Слежение за html
  gulp.watch([
    dirs.srcPath + '/*.html',
    dirs.srcPath + '/_include/*.html',
    dirs.srcPath + dirs.blocksDirName + '/**/*.html',
  ], ['watch:html']);
  // Слежение за JS
  if(lists.js.length) {
    gulp.watch(lists.js, ['watch:js']);
  }
});

// Браузерсинк с 3-м галпом — такой браузерсинк...
gulp.task('watch:img', ['copy:img'], reload);
gulp.task('watch:copied:js', ['copy:js'], reload);
gulp.task('watch:fonts', ['copy:fonts'], reload);
gulp.task('watch:svg:sprite', ['sprite:svg'], reload);
gulp.task('watch:html', ['html'], reload);
gulp.task('watch:js', ['js'], reload);



/**
 * Вернет объект с обрабатываемыми файлами и папками
 * @param  {object}
 * @return {object}
 */
function getFilesList(config){

  let res = {
    'css': [],
    'js': [],
    'img': [],
  };

  // Style
  for (let blockName in config.blocks) {
    res.css.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + '.scss');
    if(config.blocks[blockName].length) {
      config.blocks[blockName].forEach(function(elementName) {
        res.css.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + elementName + '.scss');
      });
    }
  }
  res.css = res.css.concat(config.addCssAfter);
  res.css = config.addCssBefore.concat(res.css);

  // JS
  for (let blockName in config.blocks) {
    res.js.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + '.js');
    if(config.blocks[blockName].length) {
      config.blocks[blockName].forEach(function(elementName) {
        res.js.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + elementName + '.js');
      });
    }
  }
  res.js = res.js.concat(config.addJsAfter);
  res.js = config.addJsBefore.concat(res.js);

  // Images
  for (let blockName in config.blocks) {
    res.img.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/img/*.{jpg,jpeg,gif,png,svg}');
  }
  res.img = config.addImages.concat(res.img);

  return res;
}

/**
 * Проверка существования файла или папки
 * @param  {string} path      Путь до файла или папки]
 * @return {boolean}
 */
function fileExist(path) {
  const fs = require('fs');
  try {
    fs.statSync(path);
  } catch(err) {
    return !(err && err.code === 'ENOENT');
  }
}

// Перезагрузка браузера
function reload (done) {
  browserSync.reload();
  done();
}
