/*

   bundle-pcb-models.js -- Bundle files required for PCB component display

   This tool creates a "bundle" that contains just the meta
   information required to display component models on the specified
   `.brd` file and the associated models. Reduces the quantity
   of data and number of files required compared to using the full
   component model library.


   Usage:

     node bundle-pcb-models.js <component library root directory> "<bundle suffix>" <output directory> <.brd file>


   Output:

    * Creates `components-<suffix>.json` file in output directory.
    * Creates `models-<suffix>` directory in output directory.
    * Copies required model files into `models-<suffix>` directory.

   The `components-<suffix>.json` file contains details of only the
   components used in the `.brd` file. Their associated `filename` is
   modified to use the copied model files.

   Any existing `components-<suffix>.json` file will be overwritten.

   If the models directory already exists, only models not already
   present are copied. Existing models that are no longer used are
   not deleted.

 */

var fs = require('fs-extra');
const path = require('path');
var xml2js = require('xml2js');
var stringify = require('json-stable-stringify');
var clone = require('clone');

function parseBrdFile(fileContent) {

  // TODO: Comment about `xmldom` use.

  var _board = null;

  xml2js.parseString(fileContent, {'explicitArray': false, 'mergeAttrs': true},
		     function (err, brdObject) {

		       _board = {};

		       _board.libraries = [].concat(brdObject.eagle.drawing.board.libraries.library);

		       _board.libraries.forEach(function (currentLibrary) {
			 currentLibrary.packages = [].concat(currentLibrary.packages.package);
		       });

		       _board.elements = [].concat(brdObject.eagle.drawing.board.elements.element);
		     });

  return _board;

}

const COMPONENT_MAP_FILENAME = "components.json";

var componentLibraryRootDir = process.argv[2];

var componentMapFilepath = path.join(componentLibraryRootDir, COMPONENT_MAP_FILENAME);

var bundleSuffix = process.argv[3];

var outputRootDir = process.argv[4];

var componentMapSubsetOutputFilename = COMPONENT_MAP_FILENAME.replace(".json", "-" + bundleSuffix + ".json");

var brdFilepath = process.argv[5];

var brdFileContent = fs.readFileSync(brdFilepath, 'utf8');

var components = JSON.parse(fs.readFileSync(componentMapFilepath, 'utf8'));

var componentsSubset = {};

var board = parseBrdFile(brdFileContent);

// TODO: Handle multiple .brd files on the command line.

board.libraries.forEach(function (currentLibrary) {
  //console.log(currentLibrary.name);
  currentLibrary.packages.forEach(function (currentPackage) {
    //console.log("  " + (components[currentPackage.name] ? "*" : " ") + " " + currentPackage.name);
    var component = null;

    if (component = clone(components[currentPackage.name])) {
      component.filename = component.filename.replace(new RegExp("([^\\" + path.sep + "]*)"), "$&-" + bundleSuffix);
      componentsSubset[currentPackage.name] = component;
    }
  });
});

// TODO: Allow existing file to be updated? (But this wouldn't remove outdated entries?)

var outputFilePath = path.join(outputRootDir, componentMapSubsetOutputFilename);
console.log("Writing component map: " + outputFilePath);

fs.writeFileSync(outputFilePath, stringify(componentsSubset, {space: 1}))

for (componentName in componentsSubset) {
  var modelRelativeFilePath = componentsSubset[componentName].filename;
  var modelFilePath = path.join(outputRootDir, modelRelativeFilePath);

  // TODO: Also copy file if the two files differ? (Otherwise we won't copy updated models.)
  if (!fs.existsSync(modelFilePath)) {
    var sourceFilePath = path.join(componentLibraryRootDir, components[componentName].filename);
    console.log("Creating: " + modelRelativeFilePath)
    fs.copySync(sourceFilePath, modelFilePath, {clobber: false});
  }
};

// TODO: Delete/list no longer needed model files?
