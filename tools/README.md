## How To: Incorporate SparkFun Model Repository Updates

This `tools` directory contains a number of scripts to semi-automate
the process of incorporating new models from SparkFun's repository.

 * SparkFun repository: <https://github.com/sparkfun/3D_Models>
 * Omniblox fork: <https://github.com/Omniblox/3D_Models>


### Preparation

    git clone https://github.com/Omniblox/3D_Models.git
    cd 3D_Models
    git remote add upstream https://github.com/sparkfun/3D_Models.git


### Update Procedure


#### Retrieve new models

Merge the updates from SparkFun into our `batch-stl-export` branch:

    cd 3D_Models
    git checkout master

    git pull --ff-only upstream master

    git checkout batch-stl-export
    git merge master batch-stl-export

At this stage you may need to:

 * Delete existing `.stl` files to force re-export of updated `.skp`
   files.

 * Delete other orphaned `.stl` files (if the package has a
   replacement).


#### Batch export new STL files from SketchUp

Run the batch export script (see the documentation in
`tools/generate_missing_stl.rb` for details.):

    STL_GENERATE_ROOT=/<path>/3D_Models/production_parts/ /<path>/SketchUp\ 2015/SketchUp.app/Contents/MacOS/SketchUp -RubyStartup /<path>/omniblox.github.com/pcb-component-models/tools/generate_missing_stl.rb /<path>/dummy.skp & sleep 4; osascript -e 'activate application "SketchUp"' -e 'tell application "System Events"' -e 'key code 36' -e 'end tell'

The `dummy.skp` file can be any arbitrary SketchUp file. The
`osascript` section can be ommitted if you configure the application
not to display a startup dialog.

Re-run the batch export script as needed until no new models are
identified and all exports complete successfully.


#### STL model validation

Check the generated `.stl` files appear valid e.g. with
[Pleasant3D](http://www.pleasantsoftware.com/developer/pleasant3d/).

Commit all the valid models in one commit and then any faulty models
in a different commit. (You may wish to open issues in the SparkFun
repository for any models that have problems.)


#### Import the new models into our "Standard Component Model Library"

The new models can be automatically copied into our Standard Component
Model Library and the associated component package map updated with:

    cd omniblox.github.com/pcb-component-models
    ./tools/update_model_repo.py --source-dir /<path>/3D_Models/production_parts models/sparkfun/production_parts components.json

Once the script completes the copied models and updated component map
can be committed to the repository.


#### Model Quality Assurance

Finally, QA the new models for correct orientation, scale, etc on
`.brd` files which use the component packages. Modify the meta info in
`components.json` to adjust the model to display correctly as required.

