# Phoenix Recon

[Team Wiki Page](https://github.com/cs210/2025-ManageXR-2/wiki/)

[Team Coding Standards](https://github.com/cs210/Phoenix-Recon/wiki/Team-Coding-Standards)

[Project Milestones](https://github.com/cs210/2025-ManageXR-2/milestones)

## Features Overview
### Web Portal
We created a web portal for users to upload their videos. It includes authentication, supabase storage for the videos, and other features documented in the github issues.

See more in `webapp`.

### GPS to Relative Positions

Using the GPS data of images to determine their relative positions. Determined that GPS data is not accurate enough to determine relative positions for a 3D walkthrough.

See more in `gps_to_rel_pos` and [issue #50](https://github.com/cs210/Phoenix-Recon/issues/50).

### Image Manipulation

Includes script that converts HEIC to JPEG. JPEG is the required input format for PTGui.

See more in `img_manipulation`

### 3D Reconstruction
* This is a "Priority 3" feature. 
* It will add value to users who want to experience what it feels like to walk through the space but don't need the highest-possible level of detail. These users could include recovery/response teams preparing to enter dangerous zones. 
* Creating these reconstructions and viewing them in a VR headset has posed significant technical challenges, including just to run existing models.

See more in `3D_Reconstruction`.
