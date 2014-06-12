'use strict';

var fs = require('fs'),
    path = require('path'),
    easy = require('libxmljs-easy'),
    async = require('async'),
    mkdirp = require('mkdirp');

module.exports = function (opts, done) {
  var inputDir = opts.inputDir;
  var outputDir = opts.outputDir;
  var outputFile = opts.outputFile;
  var iconName;

  var dimensions = [];

  // Use optional outputFile name or set it equal to the output dir
  // plus a '-out' suffix. So foo/arrow would produce bar/arrow/arrow-out.svg
  // outputFile = outputFile || inputDir.split(path.sep).pop() + '-out.svg';

  function getInputs(callback) {
    var paths = [];
    fs.readdir(inputDir, function(err, files) {
      if (err) {
        return callback(err);
      }

      files.forEach(function(file) {
        if(path.extname(file) !== '.svg') {
          return;
        }

        var filepath = path.join(inputDir, file);
        paths.push(filepath);
      });
      callback(null, paths);
    });
  }

  function stackFiles(files, callback) {
    var stack = [];
    files.forEach(function (file) {
      var svgXml = fs.readFileSync(file, 'utf8');
      var svg = easy.parse(svgXml);

      //record the dimensions of the svg
      var dim =Array(
        Number(parseFloat(svg.$width, 10)),
        Number(parseFloat(svg.$height, 10))
      )
      dimensions.push( dim );
      

      // strip out opening and closing svg tags
      // returning just a string with the internals

      iconName = svg.$.toString().match(/ data-icon="([^"]*)"/)[1];

      svg = svg.$.toString()
        .replace(/<svg[^<]*/, '')
        .replace(/<\/svg>$/, '');

      var group = easy.parse(['<g data-width="'+ String(dim[0]) +'" data-height="'+ String(dim[1]) +'">', svg, '</g>'].join(''));

      stack.push({
        group: group.$.toString()
      });
    });
    callback(null, stack);
  }

  function merge(stack, callback) {
    var svg = [];

    //find largest bounding box
    var bBox = dimensions.reduce(function(max, arr) {
      return max >= arr[0] ? max : arr[0];
    }, -Infinity);

    var areas = [];
    for ( var i = 0; i < dimensions.length; i++) {
      areas.push(dimensions[i][0]*dimensions[i][1]);
    }


    var ndx = areas.indexOf(Math.max.apply(Math, areas));

    svg.push('<svg version="1.1" xmlns="http://www.w3.org/2000/svg" data-icon="' + iconName + '" width="' + Math.ceil(dimensions[ndx][0]) + 'px" height="' + Math.ceil(dimensions[ndx][1]) + 'px" viewBox="0 0 ' + Math.ceil(dimensions[ndx][0]) + ' ' + Math.ceil(dimensions[ndx][1]) + '">');
    // need to make same ids from different files unique
    stack.forEach(function(icon) {
      svg.push(icon.group);
    });


    
    svg.push('</svg>');

    var svgText = svg.join('\n');
    callback(null, svgText);
  }

  function output(svgText, callback) {
    var filename = path.join(outputDir, outputFile);
    mkdirp.sync(path.join(outputDir));
    fs.writeFile(filename, svgText, function(err) {
      if (err) {
        return callback(err);
      }
      callback();
    });
  }

  function error(err) {
    console.error(err.stack);
    process.exit(err.code || 1);
  }

  async.waterfall([
    getInputs,
    stackFiles,
    merge,
    output
  ], function (err) {
    if (err) {
      error(err);
    }

    done();
  });
};