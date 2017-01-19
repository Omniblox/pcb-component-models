#!/usr/bin/python

import os
import os.path
import argparse
import sys
import filecmp
import shutil
import json


def copyUpdatedModels(source_root, destination_root):
    """
    """
    for root, dirs, files in os.walk(source_root):
        for filename in files:
            model_name, ext = os.path.splitext(filename)

            if ext in ['.stl', '.STL']:

                model_source_file_path = os.path.join(root, filename)
                destination_sub_dir = os.path.relpath(root, start=source_root)
                destination_abs_dir = os.path.abspath(os.path.join(destination_root, destination_sub_dir))
                model_destination_file_path = os.path.join(destination_abs_dir, filename)

                # Copy file (if required due to being new or different)
                if (not os.path.exists(model_destination_file_path)) or (not filecmp.cmp(model_source_file_path, model_destination_file_path)):
                    if not os.path.exists(destination_abs_dir):
                        os.makedirs(destination_abs_dir)
                    print "Copying \"%s\" (%s)" % (model_name, model_source_file_path)
                    shutil.copy2(model_source_file_path, model_destination_file_path)
    print


def updateMapFile(map_file_path, destination_root):
    """
    """

    component_map = {}

    if os.path.exists(map_file_path):
        component_map = json.load(open(map_file_path, "r"))

    for root, dirs, files in os.walk(destination_root):
        for filename in files:

            model_name, ext = os.path.splitext(filename)

            if ext in ['.stl', '.STL']:

                model_file_abspath = os.path.abspath(os.path.join(root, filename))
                model_file_relpath = os.path.relpath(model_file_abspath, start=os.path.dirname(os.path.abspath(map_file_path)))

                if component_map.has_key(model_name):
                    if (component_map[model_name]["filename"] != model_file_relpath):
                        dupes = component_map[model_name].setdefault("duplicates", [])
                        if model_file_relpath not in dupes:
                            dupes.append(model_file_relpath)
                            print "New duplicate model:", model_name
                else:
                    print "New model:", model_name
                    component_map[model_name] = {"filename": model_file_relpath}

    # TODO: Safe replacement?
    json.dump(component_map, open(map_file_path, "w"), indent=1, separators=(',', ': '), sort_keys=True)

    print
    print "Wrote map file: %s" % map_file_path
    print "Total unique components in map:", len(component_map)



if __name__ == "__main__":

    parser = argparse.ArgumentParser(description='Update standard library repository with new STL models (optional) and update the component map file.')
    parser.add_argument('--source-dir', help='copy new and updated STL models from this repository')
    parser.add_argument('dest-dir', help='destination directory within the standard library repository')
    parser.add_argument('map-file', help='path to new or existing `component.js` map file to be updated')

    args = parser.parse_args()

    source_root = args.source_dir
    destination_root = getattr(args, 'dest-dir')
    map_file_path = getattr(args, 'map-file')

    if source_root:
        copyUpdatedModels(source_root, destination_root)

    updateMapFile(map_file_path, destination_root)
