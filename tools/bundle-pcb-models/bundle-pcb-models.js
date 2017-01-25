/*

   bundle-pcb-models.js -- Bundle files required for PCB component display

   This tool creates a "bundle" that contains just the meta
   information required to display component models on the specified
   `.brd` file(s) and the associated models. Reduces the quantity
   of data and number of files required compared to using the full
   component model library.


   Usage:

     node bundle-pcb-models.js <component library root directory> "<bundle suffix>" <output directory> <.brd file> [...]


   Output:

    * Creates `components-<suffix>.json` file in output directory.
    * Creates `models-<suffix>` directory in output directory.
    * Copies required model files into `models-<suffix>` directory.

   The `components-<suffix>.json` file contains details of only the
   components used in the `.brd` file(s). Their associated `filename`
   is modified to use the copied model files.

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
  /*

     Parse the content of a `.brd` file into a Javascript
     object intermediate representation of the board file.

   */

  //
  // The object returned from this function can be considered
  // the start of work on a class representation of a `.brd` file.
  //
  // Ideally, the Eagle-Loader library will eventually use such
  // a class and create the render from the intermediate
  // representation rather than the tightly coupled parse/render
  // approach it currently uses.
  //
  // Because this effort has the potential to be useful in future
  // and in an effort to minimise the number of languages used in
  // the project this tool was implemented in Javascript rather than
  // in Python. It is intended to follow this approach going forward
  // for other related tools.
  //
  // For the moment the intention is for "features" to only be added
  // as they are needed which is why currently we're not actually
  // implementing this as a class. For the same reason we currently
  // only support retrieving libraries, packages and elements.
  //
  //
  // Implementation note:
  // Ideally we would extract the existing Eagle-Loader parsing
  // logic and use it with a library like `xmldom`[1] to minimise
  // reinvention of the wheel. However this would have required a
  // fair bit of work to create a JS object. Instead `xml2js`[2] is
  // used and we just use the existing parsing logic as a guide.
  //
  // [1] <https://www.npmjs.com/package/xmldom>
  // [2] <https://www.npmjs.com/package/xml2js>
  //

  var _board = null;

  //
  // NOTE: We treat the parsing as if it is blocking/synchronous
  //       although apparently it's sorta not?
  //
  //       See the issue entitled "Sync version of parseString (#159)":
  //
  //          <https://github.com/Leonidas-from-XIV/node-xml2js/issues/159#issuecomment-248599477>
  //
  xml2js.parseString(fileContent, {'explicitArray': false, 'mergeAttrs': true},
		     function (err, brdObject) {

		       // Note: As `explicitArray` is set to be false
		       //       it's possible that an expected "collection"
		       //       of elements might only have one entry and
		       //       thus be a single object rather than an array
		       //       of one object. We use `concat()` to handle this.
		       //       This seemed preferable to having to use `[0]`
		       //       indexes for all non-collections.
		       //       See these issues for discussion of this aspect
		       //       of `xml2js`:
		       //         * <https://github.com/Leonidas-from-XIV/node-xml2js/issues/216>
		       //         * <https://github.com/Leonidas-from-XIV/node-xml2js/issues/141>

		       _board = {};

		       _board.libraries = [].concat(brdObject.eagle.drawing.board.libraries.library);

		       _board.libraries.forEach(function (currentLibrary) {
			 currentLibrary.packages = [].concat(currentLibrary.packages.package);
		       });

		       _board.elements = [].concat(brdObject.eagle.drawing.board.elements.element);
		     });

  return _board;
};


function initBundle(componentLibraryRootDir, bundleSuffix, outputDir) {
  /*

     Initialise the bundle with supplied meta/configuration data.

     This configuration is used by the actual bundling routines.

   */

  const COMPONENT_MAP_FILENAME = "components.json";

  var _bundle = {
    suffix: bundleSuffix,
    outputDir: outputDir,
    libraryDir: componentLibraryRootDir,
    libraryComponents: null,
    components: {},
    outputMapPath: null,
  };

  var componentMapFilepath = path.join(_bundle.libraryDir, COMPONENT_MAP_FILENAME);
  _bundle.libraryComponents = JSON.parse(fs.readFileSync(componentMapFilepath, 'utf8'));

  var outputMapFilename = COMPONENT_MAP_FILENAME.replace(".json", "-" + _bundle.suffix + ".json");
  _bundle.outputMapPath = path.join(_bundle.outputDir, outputMapFilename);

  return _bundle;
};


function bundleBrdFile(bundle, filepath) {
  /*

     Extracts details of all the component packages used in the
     supplied `.brd` file that also exist in the configured component
     library.

     (Can be called more than once to bundle multiple boards.)
   */

  var _board = parseBrdFile(fs.readFileSync(filepath, 'utf8'));

  _board.libraries.forEach(function (currentLibrary) {
    currentLibrary.packages.forEach(function (currentPackage) {
      var component = null;

      if (component = clone(bundle.libraryComponents[currentPackage.name])) {
	component.filename = component.filename.replace(new RegExp("([^\\" + path.sep + "]*)"), "$&-" + bundle.suffix);
	bundle.components[currentPackage.name] = component;
      }
    });
  });

};


function writeBundle(bundle) {
  /*

     Write the bundle to the configured directory.

     A bundle consists of a tailored component map file and the set of
     model files used by the board(s).

   */

  // Create bundle-specific component map file.
  // TODO: Allow existing file to be updated? (But this wouldn't remove outdated entries?)
  console.log("Writing component map: " + bundle.outputMapPath);
  fs.writeFileSync(bundle.outputMapPath, stringify(bundle.components, {space: 1}));

  // Copy required component models into bundle.
  for (var name in bundle.components) {
    var modelFilename = bundle.components[name].filename;
    var modelFilepath = path.join(bundle.outputDir, modelFilename);

    // TODO: Also copy file if the two files differ? (Otherwise we won't copy updated models.)
    if (!fs.existsSync(modelFilepath)) {
      console.log("Creating: " + modelFilename)
      var sourceFilepath = path.join(bundle.libraryDir, bundle.libraryComponents[name].filename);
      fs.copySync(sourceFilepath, modelFilepath, {clobber: false});
    }
  };

  // TODO: Delete/list no longer needed model files?

};


var bundle = initBundle(process.argv[2], process.argv[3], process.argv[4]);

process.argv.slice(5).forEach( function(brdFilePath) {
  console.log("Processing: " + brdFilePath);
  bundleBrdFile(bundle, brdFilePath);
});

writeBundle(bundle);
