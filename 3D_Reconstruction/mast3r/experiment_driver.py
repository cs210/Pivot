#!/usr/bin/env python3
# Copyright (C) 2024-present Naver Corporation. All rights reserved.
# Licensed under CC BY-NC-SA 4.0 (non-commercial use only).
#
# --------------------------------------------------------
# sparse commandline experiment driver
# --------------------------------------------------------
import os
import sys
import time
import shutil
import itertools
import tempfile
import argparse
import copy
import math
import functools

import numpy as np
import trimesh
from scipy.spatial.transform import Rotation

import mast3r.utils.path_to_dust3r  # noqa
from dust3r.image_pairs import make_pairs
from dust3r.utils.image import load_images
from dust3r.utils.device import to_numpy
from dust3r.viz import add_scene_cam, CAM_COLORS, OPENGL, pts3d_to_trimesh, cat_meshes
from mast3r.cloud_opt.sparse_ga import sparse_global_alignment
from mast3r.cloud_opt.tsdf_optimizer import TSDFPostProcess

import torch

torch.set_grad_enabled(False)


class SparseGAState():
    def __init__(self, sparse_ga, should_delete=False, cache_dir=None, outfile_name=None):
        self.sparse_ga = sparse_ga
        self.cache_dir = cache_dir
        self.outfile_name = outfile_name
        self.should_delete = should_delete

    def __del__(self):
        if not self.should_delete:
            return
        if self.cache_dir is not None and os.path.isdir(self.cache_dir):
            shutil.rmtree(self.cache_dir)
        self.cache_dir = None
        if self.outfile_name is not None and os.path.isfile(self.outfile_name):
            os.remove(self.outfile_name)
        self.outfile_name = None


def _convert_scene_output_to_glb(outfile, imgs, pts3d, mask, focals, cams2world, cam_size=0.05,
                                 cam_color=None, as_pointcloud=False,
                                 transparent_cams=False, silent=True):  # SILENT=TRUE
    assert len(pts3d) == len(mask) <= len(imgs) <= len(cams2world) == len(focals)
    pts3d = to_numpy(pts3d)
    imgs = to_numpy(imgs)
    focals = to_numpy(focals)
    cams2world = to_numpy(cams2world)

    scene = trimesh.Scene()

    # full pointcloud
    if as_pointcloud:
        pts = np.concatenate([p[m.ravel()] for p, m in zip(pts3d, mask)]).reshape(-1, 3)
        col = np.concatenate([p[m] for p, m in zip(imgs, mask)]).reshape(-1, 3)
        valid_msk = np.isfinite(pts.sum(axis=1))
        pct = trimesh.PointCloud(pts[valid_msk], colors=col[valid_msk])
        scene.add_geometry(pct)
    else:
        meshes = []
        for i in range(len(imgs)):
            pts3d_i = pts3d[i].reshape(imgs[i].shape)
            msk_i = mask[i] & np.isfinite(pts3d_i.sum(axis=-1))
            meshes.append(pts3d_to_trimesh(imgs[i], pts3d_i, msk_i))
        mesh = trimesh.Trimesh(**cat_meshes(meshes))
        scene.add_geometry(mesh)

    # add each camera
    for i, pose_c2w in enumerate(cams2world):
        if isinstance(cam_color, list):
            camera_edge_color = cam_color[i]
        else:
            camera_edge_color = cam_color or CAM_COLORS[i % len(CAM_COLORS)]
        add_scene_cam(scene, pose_c2w, camera_edge_color,
                      None if transparent_cams else imgs[i], focals[i],
                      imsize=imgs[i].shape[1::-1], screen_width=cam_size)

    rot = np.eye(4)
    rot[:3, :3] = Rotation.from_euler('y', np.deg2rad(180)).as_matrix()
    scene.apply_transform(np.linalg.inv(cams2world[0] @ OPENGL @ rot))
    if not silent:
        print('(exporting 3D scene to', outfile, ')')
    scene.export(file_obj=outfile)
    return outfile


def get_3D_model_from_scene(silent, scene_state, min_conf_thr=2, as_pointcloud=False, mask_sky=False,
                            clean_depth=False, transparent_cams=False, cam_size=0.05, TSDF_thresh=0):
    """
    extract 3D_model (glb file) from a reconstructed scene
    """
    if scene_state is None:
        return None
    outfile = scene_state.outfile_name
    if outfile is None:
        return None

    # get optimized values from scene
    scene = scene_state.sparse_ga
    rgbimg = scene.imgs
    focals = scene.get_focals().cpu()
    cams2world = scene.get_im_poses().cpu()

    # 3D pointcloud from depthmap, poses and intrinsics
    if TSDF_thresh > 0:
        tsdf = TSDFPostProcess(scene, TSDF_thresh=TSDF_thresh)
        pts3d, _, confs = to_numpy(tsdf.get_dense_pts3d(clean_depth=clean_depth))
    else:
        pts3d, _, confs = to_numpy(scene.get_dense_pts3d(clean_depth=clean_depth))
    msk = to_numpy([c > min_conf_thr for c in confs])
    return _convert_scene_output_to_glb(outfile, rgbimg, pts3d, msk, focals, cams2world, as_pointcloud=as_pointcloud,
                                        transparent_cams=transparent_cams, cam_size=cam_size, silent=silent)


def get_reconstructed_scene(outdir, gradio_delete_cache, model, device, silent, image_size, current_scene_state,
                            filelist, optim_level, lr1, niter1, lr2, niter2, min_conf_thr, matching_conf_thr,
                            as_pointcloud, mask_sky, clean_depth, transparent_cams, cam_size, scenegraph_type, winsize,
                            win_cyclic, refid, TSDF_thresh, shared_intrinsics, **kw):
    """
    from a list of images, run mast3r inference, sparse global aligner.
    then run get_3D_model_from_scene
    """
    imgs = load_images(filelist, size=image_size, verbose=not silent)
    if len(imgs) == 1:
        imgs = [imgs[0], copy.deepcopy(imgs[0])]
        imgs[1]['idx'] = 1
        filelist = [filelist[0], filelist[0] + '_2']

    scene_graph_params = [scenegraph_type]
    if scenegraph_type in ["swin", "logwin"]:
        scene_graph_params.append(str(winsize))
    elif scenegraph_type == "oneref":
        scene_graph_params.append(str(refid))
    if scenegraph_type in ["swin", "logwin"] and not win_cyclic:
        scene_graph_params.append('noncyclic')
    scene_graph = '-'.join(scene_graph_params)
    pairs = make_pairs(imgs, scene_graph=scene_graph, prefilter=None, symmetrize=True)
    if optim_level == 'coarse':
        niter2 = 0
    # Sparse GA (forward mast3r -> matching -> 3D optim -> 2D refinement -> triangulation)
    if current_scene_state is not None and \
            not current_scene_state.should_delete and \
            current_scene_state.cache_dir is not None:
        cache_dir = current_scene_state.cache_dir
    elif gradio_delete_cache:
        cache_dir = tempfile.mkdtemp(suffix='_cache', dir=outdir)
    else:
        cache_dir = os.path.join(outdir, 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    scene = sparse_global_alignment(filelist, pairs, cache_dir,
                                    model, lr1=lr1, niter1=niter1, lr2=lr2, niter2=niter2, device=device,
                                    opt_depth='depth' in optim_level, shared_intrinsics=shared_intrinsics,
                                    matching_conf_thr=matching_conf_thr, **kw)
    if current_scene_state is not None and \
            not current_scene_state.should_delete and \
            current_scene_state.outfile_name is not None:
        outfile_name = current_scene_state.outfile_name
    else:
        outfile_name = tempfile.mktemp(suffix='_scene.glb', dir=outdir)

    scene_state = SparseGAState(scene, gradio_delete_cache, cache_dir, outfile_name)
    outfile = get_3D_model_from_scene(silent, scene_state, min_conf_thr, as_pointcloud, mask_sky,
                                      clean_depth, transparent_cams, cam_size, TSDF_thresh)
    return scene_state, outfile

def run_experiment(experiment_name, image_subset, outdir, gradio_delete_cache, model, device, silent, image_size,
                   optim_level, lr1, niter1, lr2, niter2, min_conf_thr, matching_conf_thr,
                   as_pointcloud, mask_sky, clean_depth, transparent_cams, cam_size, scenegraph_type, winsize,
                   win_cyclic, refid, TSDF_thresh, shared_intrinsics):
    """Runs a single MASt3R experiment."""
    tmpdirname = os.path.join(outdir, experiment_name)
    os.makedirs(tmpdirname, exist_ok=True)
    current_scene_state = None  # No previous state in this setup

    try:
        scene_state, outfile = get_reconstructed_scene(
            tmpdirname, gradio_delete_cache, model, device, silent, image_size, current_scene_state,
            image_subset, optim_level, lr1, niter1, lr2, niter2, min_conf_thr, matching_conf_thr,
            as_pointcloud, mask_sky, clean_depth, transparent_cams, cam_size, scenegraph_type, winsize,
            win_cyclic, refid, TSDF_thresh, shared_intrinsics
        )

        print(f"Experiment {experiment_name}: Saved GLB to {outfile}")
        return True

    except Exception as e:
        print(f"Experiment {experiment_name}: Failed with error: {e}")
        return False



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run MASt3R experiments.')
    parser.add_argument('--image_dir', type=str, default='pics', help='Directory containing images.')
    parser.add_argument('--output_dir', type=str, default='experiments', help='Directory to save GLB files.')
    parser.add_argument('--model', type=str, default="MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric",
                        help='MASt3R model name or path.')  # <--- IMPORTANT:  Now expects model *name*
    parser.add_argument('--device', type=str, default='cuda', help='Device to use (cuda or cpu).')
    parser.add_argument('--image_size', type=int, default=512, help='Image size for MASt3R.')
    parser.add_argument('--base_cache_dir', type=str, default='cache',
                        help='Base directory for caching MASt3R results.')
    parser.add_argument('--shared_intrinsics', action='store_true',
                        help='Only optimize one set of intrinsics for all views')
    parser.add_argument('--gradio_delete_cache', default=None, type=int,
                        help='age/frequency at which gradio removes the file. If >0, matching cache is purged')
    parser.add_argument('--silent', action='store_true', help='Suppress verbose output')

    # Parameter ranges (example ranges, adjust as needed)
    parser.add_argument('--lr1_values', nargs='+', type=float, default=[0.07], help='Coarse LR values.')
    parser.add_argument('--niter1_values', nargs='+', type=int, default=[500], help='Coarse iteration values.')
    parser.add_argument('--lr2_values', nargs='+', type=float, default=[0.014], help='Fine LR values.')
    parser.add_argument('--niter2_values', nargs='+', type=int, default=[200], help='Fine iteration values.')
    parser.add_argument('--min_conf_thr_values', nargs='+', type=float, default=[1.5],
                        help='Min confidence threshold values.')
    parser.add_argument('--matching_conf_thr_values', nargs='+', type=float, default=[5.0],
                        help='Matching confidence threshold values.')
    parser.add_argument('--cam_size_values', nargs='+', type=float, default=[0.2], help='Camera size values.')
    parser.add_argument('--as_pointcloud_values', nargs='+', type=bool, default=[True],
                        help='As pointcloud values')
    parser.add_argument('--mask_sky_values', nargs='+', type=bool, default=[False], help='Mask sky values')
    parser.add_argument('--clean_depth_values', nargs='+', type=bool, default=[True],
                        help='Clean depth values')
    parser.add_argument('--transparent_cams_values', nargs='+', type=bool, default=[False],
                        help='Transparent cams values')
    parser.add_argument('--TSDF_thresh_values', nargs='+', type=float, default=[0.0],
                        help='TSDF threshold values.')
    parser.add_argument('--optim_level_values', nargs='+', type=str, default=['refine+depth'],
                        help='Optimization level values')
    parser.add_argument('--scenegraph_type_values', nargs='+', type=str, default=['complete'],
                        help='Scenegraph type values')
    parser.add_argument('--winsize_values', nargs='+', type=int, default=[1], help='Winsize values')
    parser.add_argument('--win_cyclic_values', nargs='+', type=bool, default=[False], help='Win cyclic values')
    parser.add_argument('--refid_values', nargs='+', type=int, default=[0], help='Ref ID values')

    args = parser.parse_args()

    # Set the device according to args:
    device = torch.device('cuda' if torch.cuda.is_available() and args.device == 'cuda' else 'cpu')

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Load image files
    image_files = sorted([os.path.join(args.image_dir, f) for f in os.listdir(args.image_dir) if
                          f.lower().endswith(('.png', '.jpg', '.jpeg'))])

    # Define the parameter grid
    param_names = ['lr1', 'niter1', 'lr2', 'niter2', 'min_conf_thr', 'matching_conf_thr', 'cam_size',
                   'as_pointcloud', 'mask_sky', 'clean_depth', 'transparent_cams', 'TSDF_thresh',
                   'optim_level', 'scenegraph_type', 'winsize', 'win_cyclic', 'refid']
    param_values = [getattr(args, f'{name}_values') for name in param_names]

    # Create all combinations of parameters using itertools.product
    param_combinations = list(itertools.product(*param_values))

    # 1. Experiments on every other image
    half_image_files = image_files[::2]
    print("Starting experiments on every other image...")
    for i, params in enumerate(param_combinations):
        experiment_name = f"half_experiment_{i}"
        print(f"Starting {experiment_name}...")

        # Unpack parameters for this experiment
        experiment_kwargs = dict(zip(param_names, params))

        # Run the experiment
        success = run_experiment(experiment_name, half_image_files, args.output_dir, args.gradio_delete_cache,
                                 args.model, device, args.silent, args.image_size, **experiment_kwargs, shared_intrinsics=False)
        if not success:
            print(f"Failed {experiment_name}, see error log")
    print("Completed experiments on every other image.")

    # 2. Experiments on all images
    image_files = image_files  # Use the full set
    print("Starting experiments on all images...")
    for i, params in enumerate(param_combinations):
        experiment_name = f"full_experiment_{i}"
        print(f"Starting {experiment_name}...")

        # Unpack parameters for this experiment
        experiment_kwargs = dict(zip(param_names, params))

        # Run the experiment
        success = run_experiment(experiment_name, image_files, args.output_dir, args.gradio_delete_cache,
                                 args.model, device, args.silent, args.image_size, **experiment_kwargs, shared_intrinsics=False)
        if not success:
            print(f"Failed {experiment_name}, see error log")
    print("Completed experiments on all images.")

    print("All experiments completed.")