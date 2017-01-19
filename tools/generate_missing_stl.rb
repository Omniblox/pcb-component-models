#!/usr/bin/env ruby
#
# generate_missing_stl.rb -- Walk a directory structure & export missing STL files with SketchUp
#
# Developed in order to generate the missing STL files in SparkFun's
# 3D Model repository for which source SketchUp `.skp` files exist.
#
# Written to work with SketchUp 2015, `sketchup-stl` extension & Mac OS X.
#
#
# Note: You will need to babysit this script when running it because
#       exporting seems to frequently fail non-deterministically with
#       either segfaults or Ruby errors. Eventually re-running the
#       automation enough times generated all the files for our purposes.
#
#
# Usage:
#
#  (1) The script can be used to scan a directory hierarchy to list
#      `.skp` files for which no `.stl` file exists (searched
#      according to directory layout used in SparkFun repository).
#
#  (2) The script can be used to generate the missing `.stl` files by
#      automating SketchUp.  Rather than running as a plugin (which
#      could be investigated to see if it's more reliable) this script
#      automates SketchUp itself by being run as a startup script.
#
#      As arguments cannot be supplied to a startup script as part of
#      the command line, the directory root to be scanned is supplied
#      in the `STL_GENERATE_ROOT` environment variable. (If this
#      environment variable is set manually then this script can also
#      be started via `load '/<path>/generate_missing_stl.rb'` in the
#      SketchUpRuby console.)
#
#      In addition, a "dummy"/empty `.skp` file needs to be present
#      and the file path supplied to the command line for opening,
#      otherwise the startup script is not executed.
#
#      An example full command line to begin the automation is:
#
#        STL_GENERATE_ROOT=/<path>/sparkfun-github/3D_Models/production_parts/ /<path>/SketchUp\ 2015/SketchUp.app/Contents/MacOS/SketchUp -RubyStartup /<path>/generate_missing_stl.rb /<path>/dummy.skp
#
#      If a splash screen is displayed on opening of the SketchUp app
#      then it needs to be configured to not display or AppleScript
#      needs to be used to close it:
#
#        STL_GENERATE_ROOT=/<path>/sparkfun-github/3D_Models/production_parts/ /<path>/SketchUp\ 2015/SketchUp.app/Contents/MacOS/SketchUp -RubyStartup /<path>/generate_missing_stl.rb /<path>/dummy.skp & sleep 4; osascript -e 'activate application "SketchUp"' -e 'tell application "System Events"' -e 'key code 36' -e 'end tell'
#
#      A limit of `BATCH_SIZE` exports are attempted per run of the
#      script in order to reduce chances of a "runaway" script. This
#      value can be increased if desired.
#
#
# Troubleshooting:
#
# For reasons unknown, it seems a delay is needed between opening a
# model and exporting it when multiple models are being exported.
#
# If this delay is not long enough the segfault and Ruby errors
# mentioned above seem to be more likely to occur. If required, this
# delay can be increased further.
#
# If a Ruby error occurs and is caught, the empty/partial/incorrectly
# exported `.stl` file will be renamed to have a `bad.` prefix in
# order to allow another export attempt to be tried without having to
# delete the bad file.
#
# IF A SEGFAULT OCCURS YOU MAY NEED TO DELETE THE LAST LISTED FILE
# LOGGED AS "Exporting :". If you do not, a partially exported file
# may exist and this will prevent another attempt at export.
#

require 'FileUtils'

within_sketchup = true

begin
  require 'SketchUp'
rescue LoadError
  within_sketchup = false
end


directory_root = ARGV[0] || ENV["STL_GENERATE_ROOT"]

puts "Scanning root: " + directory_root
puts ""


# Note: Case-insensitive file systems mean the case of the filepath
#       logged may not match the case of the path on the disk.

BATCH_SIZE = 20
batch_count = 0


if within_sketchup
    # Can help debugging but also messes with logging due to inconsistent print/puts behaviour.
    #Sketchup.send_action "showRubyPanel:"
end


Dir.glob(File.join(directory_root, "**/*.skp")) {
  |filepath|

  base_directory = File.dirname(filepath)
  base_name = File.basename(filepath, ".skp")

  # Note: SparkFun repository stores the matching `.stl` file in one of two possible locations.
  exported_stl_filepath_style_one = File.join(base_directory, base_name + ".stl") # In same directory
  exported_stl_filepath_style_two = File.join(File.dirname(base_directory), "stl", base_name + ".stl") # In sibling directory

  next if base_name.start_with? "AutoSave_" # TODO: Log this?
  next if base_name.include? " - Copy"

  if [exported_stl_filepath_style_one,
      exported_stl_filepath_style_two].any? {|export_filepath| File.exist? export_filepath }
    # TODO: Log existing files found?
  else

    # Determine what directory to export the model into, based on the
    # directory naming convention used for the `.skp` file.
    export_directory = base_directory
    if File.basename(base_directory) == "skp"
      # Export to `stl` sibling directory
      export_directory = File.join(File.dirname(export_directory), "stl")
    end
    export_filepath = File.join(export_directory, base_name + ".stl")

    # Do the actual export
    if within_sketchup
      print "Found: " + filepath
      print "  Exporting: " + export_filepath

      Sketchup.open_file filepath
      FileUtils.mkdir_p export_directory
      sleep 5 # Note: Increasing this delay may increase reliability at the cost of longer runtime.

      begin
        CommunityExtensions::STL::Exporter.export(export_filepath)
        print "  Exported."
      rescue
        print "  Error exporting: " + export_filepath
        bad_export_filepath = File.join(export_directory, "bad." + base_name + ".stl")
        File.rename export_filepath, bad_export_filepath
        print "  Bad export renamed: " + bad_export_filepath
      end
      sleep 1

      Sketchup.send_action('performClose:')
      sleep 3

      batch_count += 1
      if ((batch_count % BATCH_SIZE) == 0)
        print "Batch limit reached."
        break
      end

    else
      puts "Found: " + filepath
    end
  end

}

print "Done."


