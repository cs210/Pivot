# Phoenix Recon

[Team Wiki Page](https://github.com/cs210/2025-ManageXR-2/wiki/)

[Team Coding Standards](https://github.com/cs210/Phoenix-Recon/wiki/Team-Coding-Standards)

[Project Milestones](https://github.com/cs210/2025-ManageXR-2/milestones)

[Product Requirements Document](https://docs.google.com/document/d/1jG3TpzOdq8mq9hlyTwwn-EBwxiXAfL_b9FL28QPo6WE/edit?tab=t.0#heading=h.p6o1yo1yd1du)

## Features Overview
### Web Portal
We created a web portal for users to (i) upload their raw images or 360 images, (ii) generate 360 images from raw images, (iii) organize these 360 images in space, and (iv) view a 360 walkthrough of their space. It includes authentication, supabase storage for the videos, and other features documented in the github issues.

See more in `webapp`.

### VR Viewer
This folder contains the Unity Project which allows users to experience a 360 walkthrough of their space.

See more in `vr_viewer`.

### Image Manipulation

Includes script that converts HEIC to JPEG. JPEG is the required input format for PTGui, which is the 360 image generation software that we use.

See more in `img_manipulation`.