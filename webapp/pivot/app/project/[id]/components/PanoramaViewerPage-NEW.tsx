/* while we're trying to fix existing bugs / decide whether to rollback
 * this is a saved wip of my attempt at implementing panorama blurring/censoring
 *
 * existing bugs (that i know of):
 * - creating new blurs and deleting existing blurs dont save properly (upon refresh)
 * - when i zoom out the blurs zoom out too much
 * - if u pan too much to the right/left the image gets "stretched out" but the blur remains the same size
 */
// "use client";

// import React, { useEffect, useState, useRef, useCallback } from "react";
// import dynamic from "next/dynamic";
// import { createClient } from "@/utils/supabase/client";
// import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
// import { useGrids } from "../../../../hooks/useGrids";
// import { usePanoramas, Panorama } from "../../../../hooks/usePanoramas";

// // Dynamically import ReactPhotoSphereViewer to avoid SSR issues
// const ReactPhotoSphereViewer = dynamic(
//   () =>
//     import("react-photo-sphere-viewer").then(
//       (mod) => mod.ReactPhotoSphereViewer
//     ),
//   { ssr: false }
// );

// interface Marker {
//   id: string;
//   position: {
//     yaw?: number;
//     pitch?: number;
//     longitude?: number;
//     latitude?: number;
//   };
//   tooltip?:
//     | string
//     | {
//         content: string;
//         position?: string;
//       }
//     | HTMLElement;
//   image?: string;
//   size?: {
//     width: number;
//     height: number;
//   };
//   anchor?: string;
//   html?: string;
//   data?: {
//     /* ✨ can now be "blur" as well */
//     type?: "navigation" | "blur";
//     targetPanoramaId?: string | null;
//     /* store size (in px) for blur */
//     w?: number;
//     h?: number;
//   };
// }

// interface PanoramaViewerPageProps {
//   projectId: string;
//   isSharedView?: boolean;
// }

// export default function PanoramaViewerPage({
//   projectId,
//   isSharedView = false,
// }: PanoramaViewerPageProps) {
//   const supabase = createClient();
//   const USE_HTML_MARKER = true;

//   /* ------------------------------------------------------------------
//    * Grid / panorama data hooks
//    * ----------------------------------------------------------------*/
//   const { rows, cols, fetchData, getNodeAtPosition } = useGrids(projectId);
//   const { panoramas, updatePanorama } = usePanoramas(projectId);

//   /* ------------------------------------------------------------------
//    * State
//    * ----------------------------------------------------------------*/
//   const [currentPanorama, setCurrentPanorama] = useState<Panorama | null>(null);
//   const [editingMarker, setEditingMarker] = useState<string | null>(null);
//   const [markerInput, setMarkerInput] = useState<string>("");
//   const [showHelpModal, setShowHelpModal] = useState(false);
//   /* === BLUR PATCH ‒ extend creation modes === */
//   const [creationMode, setCreationMode] = useState<
//     "annotation" | "navigation" | "blur"
//   >("annotation");
//   const [viewerMode, setViewerMode] = useState<"view" | "edit">("view");
//   const [isPanoReady, setIsPanoReady] = useState(false);

//   /* ------------------------------------------------------------------
//    * Refs (to have latest values in listener callbacks)
//    * ----------------------------------------------------------------*/
//   const creationModeRef = useRef(creationMode);
//   const viewerModeRef = useRef(viewerMode);
//   useEffect(() => {
//     creationModeRef.current = creationMode;
//   }, [creationMode]);
//   useEffect(() => {
//     viewerModeRef.current = viewerMode;
//   }, [viewerMode]);

//   /* ------------------------------------------------------------------
//    * DOM / plugin refs
//    * ----------------------------------------------------------------*/
//   const photoViewerRef = useRef<any>(null);
//   const markersPluginRef = useRef<any>(null);

//   /* === BLUR PATCH helpers === */
//   const blurPreviewRef = useRef<HTMLDivElement | null>(null); // live preview div

//   /* ------------------------------------------------------------------
//    * Fetch grid data once
//    * ----------------------------------------------------------------*/
//   useEffect(() => {
//     fetchData();
//   }, [projectId]);

//   /* ------------------------------------------------------------------
//    * Auto-select (0,0) panorama when possible
//    * ----------------------------------------------------------------*/
//   useEffect(() => {
//     if (rows && cols && panoramas.length && !currentPanorama) {
//       const node = getNodeAtPosition(0, 0);
//       if (node?.panorama_id) {
//         const pano = panoramas.find((p) => p.id === node.panorama_id);
//         if (pano) setCurrentPanorama(pano);
//       }
//     }
//   }, [rows, cols, panoramas, currentPanorama, getNodeAtPosition]);

//   /* ------------------------------------------------------------------
//    *  Freeze / un-freeze viewer interactions in Edit-Blur mode 🥶
//    * ----------------------------------------------------------------*/
//   useEffect(() => {
//     const viewer = photoViewerRef.current?.viewer as any;
//     if (!viewer) return;

//     const container = viewer.container as HTMLElement;
//     const frozen = viewerMode === "edit" && creationMode === "blur";

//     // 1️⃣  Disable / enable interaction options
//     viewer.setOption("mousemove", !frozen);
//     viewer.setOption("mousewheel", !frozen);
//     viewer.setOption("keyboard", !frozen);

//     // 2️⃣  Visually and functionally block navbar controls
//     if (frozen) {
//       container.classList.add("psv-frozen");
//     } else {
//       container.classList.remove("psv-frozen");
//     }
//   }, [creationMode, viewerMode]);

//   useEffect(() => {
//     setIsPanoReady(false); // every time the panorama id changes, we’re loading
//   }, [currentPanorama?.id]);

//   /* ------------------------------------------------------------------
//    * Grid cell click -> change panorama
//    * ----------------------------------------------------------------*/
//   const handleCellClick = (x: number, y: number) => {
//     const node = getNodeAtPosition(x, y);
//     if (!node?.panorama_id) return;

//     const pano = panoramas.find((p) => p.id === node.panorama_id);
//     if (!pano) return;

//     if (photoViewerRef.current?.viewer) {
//       try {
//         markersPluginRef.current = null;
//         photoViewerRef.current.viewer.destroy();
//       } catch {}
//     }

//     setEditingMarker(null);
//     setMarkerInput("");
//     setCurrentPanorama(pano);
//   };

//   /* ------------------------------------------------------------------
//    * Utility: remove marker completely (plugin + metadata, no DB)
//    * ----------------------------------------------------------------*/
//   const removeMarkerLocal = (markerId: string) => {
//     markersPluginRef.current?.removeMarker(markerId);
//     setCurrentPanorama((prev) => {
//       if (!prev) return prev;
//       const remaining = (prev.metadata?.annotations || []).filter(
//         (m: Marker) => m.id !== markerId
//       );
//       return {
//         ...prev,
//         metadata: { ...(prev.metadata || {}), annotations: remaining },
//       } as Panorama;
//     });
//   };

//   /* ------------------------------------------------------------------
//    * Viewer initialisation
//    * ----------------------------------------------------------------*/
//   const initializeViewer = useCallback(
//     (viewer: any) => {
//       if (!viewer || !currentPanorama) return;
//       markersPluginRef.current = viewer.getPlugin(MarkersPlugin);
//       /* -------------------------------------------------------------
//        *  Cross-version helper: return current “FOV”
//        *  v5 ➜ getFov()          |  v4 ➜ getZoomLevel()
//        * ------------------------------------------------------------*/
//       const currentFov = () =>
//         typeof viewer.getFov === "function"
//           ? viewer.getFov()
//           : typeof viewer.getZoomLevel === "function"
//           ? viewer.getZoomLevel()
//           : 0; // graceful fallback
//       if (!markersPluginRef.current) return;

//       /* ────────────────────────────────────────────────────────────────┐
//    🔄  Dynamic scale for blur patches
//    – store the FOV at creation time  ➜  scale by baseFov / currFov
//    ────────────────────────────────────────────────────────────────┘ */

//       /* helper: refresh size of ALL blur rectangles */
//       const updateBlurScales = () => {
//         const currFov = currentFov(); // current field-of-view
//         (
//           viewer.container.querySelectorAll(
//             ".blur-marker[data-base-fov]"
//           ) as NodeListOf<HTMLElement>
//         ).forEach((el) => {
//           const base = parseFloat(el.dataset.baseFov || "0");
//           if (!base) return;
//           const factor = base / currFov;
//           el.style.transform = `translate(-50%, -50%) scale(${factor})`;
//         });
//       };

//       /* call once now, then on every zoom change */
//       updateBlurScales();
//       viewer.addEventListener("zoom-updated", updateBlurScales);

//       /* put this just after you define `viewer` and `markersPluginRef` inside initializeViewer */

//       /* ---------------------------------------------------------
//        *  Hard-block PSV interactions **and** start blur-drag
//        * --------------------------------------------------------*/
//       const stopIfBlur = (ev: Event) => {
//         if (
//           viewerModeRef.current === "edit" &&
//           creationModeRef.current === "blur"
//         ) {
//           const isBlurMarker = (ev.target as HTMLElement)?.closest(
//             ".blur-marker"
//           );
//           if (isBlurMarker) {
//             /* Clicked an existing blur patch → let PSV handle it
//      (no drag start, no stopPropagation, no preventDefault) */
//             return;
//           }
//           /* ----- start the drag on mousedown / touchstart ----- */
//           if (
//             (ev.type === "mousedown" && (ev as MouseEvent).button === 0) ||
//             ev.type === "touchstart"
//           ) {
//             const clientX =
//               (ev as TouchEvent).touches?.[0]?.clientX ??
//               (ev as MouseEvent).clientX;
//             const clientY =
//               (ev as TouchEvent).touches?.[0]?.clientY ??
//               (ev as MouseEvent).clientY;

//             // Convert screen->spherical once for the rectangle centre
//             const rect = viewer.container.getBoundingClientRect();
//             const { yaw, pitch } =
//               viewer.dataHelper.viewerCoordsToSphericalCoords({
//                 x: clientX - rect.left,
//                 y: clientY - rect.top,
//               }) || {};
//             if (yaw != null) {
//               blurStart = { x: clientX, y: clientY, yaw, pitch };

//               // Create / reset the blue preview box
//               if (!blurPreviewRef.current) {
//                 const div = document.createElement("div");
//                 div.className = "blur-marker blur-preview";
//                 div.style.position = "fixed";
//                 div.style.pointerEvents = "none";
//                 document.body.appendChild(div);
//                 blurPreviewRef.current = div;
//               }
//             }
//           }

//           /* Block PSV’s own handlers */
//           ev.stopPropagation();
//           ev.preventDefault();
//         }
//       };

//       /* capture-phase listeners fire before PSV’s bubble listeners */
//       viewer.container.addEventListener("mousedown", stopIfBlur, {
//         capture: true,
//       });
//       viewer.container.addEventListener("touchstart", stopIfBlur, {
//         capture: true,
//       });
//       viewer.container.addEventListener("wheel", stopIfBlur, { capture: true });

//       /* ---------- Render existing markers ---------- */
//       const anns = currentPanorama.metadata?.annotations || [];
//       markersPluginRef.current.clearMarkers();
//       anns.forEach((m: Marker) => {
//         try {
//           if (m.data?.type === "blur") {
//             markersPluginRef.current.addMarker({
//               ...m,
//               anchor: "center center",
//               html: m.html?.includes("data-base-fov")
//                 ? m.html // already has attr
//                 : m.html?.replace(
//                     "<div",
//                     `<div data-base-fov="${m.data?.baseFov ?? currentFov()}"`
//                   ),
//             });
//             return;
//           }

//           // navigation / annotation
//           const updatedMarker = {
//             ...m,
//             html:
//               m.data?.type === "navigation"
//                 ? `
//                 <div class="navigation-marker">
//                   <div class="navigation-marker-inner"></div>
//                 </div>
//               `
//                 : `
//                 <div class="annotation-marker">
//                   <div class="annotation-marker-inner"></div>
//                 </div>
//               `,
//             anchor: "center center",
//           };
//           markersPluginRef.current.addMarker(updatedMarker);
//         } catch {}
//       });

//       /* ---------- BLUR helper -------------- */
//       const makeBlurMarker = async (
//         yaw: number,
//         pitch: number,
//         w: number,
//         h: number
//       ) => {
//         const id = `blur-${Date.now()}`;
//         const baseFov = currentFov(); // ← current FOV snapshot

//         const markerData: Marker = {
//           id,
//           position: { yaw, pitch },
//           html: `<div class="blur-marker"
//                        data-base-fov="${baseFov}"
//                        style="width:${w}px;height:${h}px;"></div>`,
//           anchor: "center center",
//           data: { type: "blur", w, h, baseFov }, // keep for persistence
//         };
//         markersPluginRef.current.addMarker(markerData);

//         // persist immediately
//         const latest = currentPanorama.metadata?.annotations || [];
//         const meta = {
//           ...(currentPanorama.metadata || {}),
//           annotations: [...latest, markerData],
//         };
//         await updatePanorama(currentPanorama.id, { metadata: meta });
//         setCurrentPanorama((prev) =>
//           prev ? { ...prev, metadata: meta } : prev
//         );
//       };

//       /* ---------- Click / drag logic ---------- */
//       let blurStart: {
//         x: number;
//         y: number;
//         yaw: number;
//         pitch: number;
//       } | null = null;

//       /* ---- Plain CLICK handler (existing) ---- */
//       viewer.addEventListener("click", async (e: any) => {
//         if (
//           isSharedView ||
//           viewerModeRef.current !== "edit" ||
//           e.data.rightClick
//         )
//           return;

//         /* === BLUR PATCH (simple single-click if user just taps) === */
//         if (creationModeRef.current === "blur") {
//           await makeBlurMarker(e.data.yaw, e.data.pitch, 120, 80); // default 120×80px
//           return;
//         }

//         const id = `marker-${Date.now()}`;
//         const base: Partial<Marker> = {
//           id,
//           position: { yaw: e.data.yaw, pitch: e.data.pitch },
//         };

//         if (creationModeRef.current === "annotation") {
//           const markerData = {
//             ...base,
//             tooltip: { content: "" },
//             html: `
//               <div class="annotation-marker">
//                 <div class="annotation-marker-inner"></div>
//               </div>
//             `,
//             anchor: "center center",
//           };

//           markersPluginRef.current.addMarker(markerData);
//           setCurrentPanorama((prevPanorama) => {
//             if (!prevPanorama) return prevPanorama;
//             const latestAnnotations = prevPanorama.metadata?.annotations || [];
//             const updatedMetadata = {
//               ...(prevPanorama.metadata || {}),
//               annotations: [...latestAnnotations, markerData],
//             };
//             return {
//               ...prevPanorama,
//               metadata: updatedMetadata,
//             };
//           });
//         } else if (creationModeRef.current === "navigation") {
//           const markerData = {
//             ...base,
//             html: `
//               <div class="navigation-marker">
//                 <div class="navigation-marker-inner"></div>
//               </div>
//             `,
//             anchor: "center center",
//             data: {
//               type: "navigation",
//               targetPanoramaId: null,
//             },
//           };

//           markersPluginRef.current.addMarker(markerData);
//           setCurrentPanorama((prevPanorama) => {
//             if (!prevPanorama) return prevPanorama;
//             const latestAnnotations = prevPanorama.metadata?.annotations || [];
//             const updatedMetadata = {
//               ...(prevPanorama.metadata || {}),
//               annotations: [...latestAnnotations, markerData],
//             };
//             return {
//               ...prevPanorama,
//               metadata: updatedMetadata,
//             };
//           });
//         }

//         setEditingMarker(id);
//         setMarkerInput("");
//       });

//       /* ---- MOUSEDOWN (start blur-drag) ---- */
//       viewer.container.addEventListener("mousedown", (ev: MouseEvent) => {
//         if (
//           creationModeRef.current !== "blur" ||
//           viewerModeRef.current !== "edit"
//         )
//           return;
//         ev.preventDefault();
//         // translate viewer → spherical
//         const { yaw, pitch } =
//           viewer.dataHelper.viewerCoordsToSphericalCoords({
//             x: ev.clientX,
//             y: ev.clientY,
//           }) || {};
//         if (yaw == null) return;
//         blurStart = { x: ev.clientX, y: ev.clientY, yaw, pitch };

//         // create preview div
//         if (!blurPreviewRef.current) {
//           const div = document.createElement("div");
//           div.className = "blur-marker blur-preview";
//           div.style.position = "fixed";
//           div.style.pointerEvents = "none";
//           document.body.appendChild(div);
//           blurPreviewRef.current = div;
//         }
//       });

//       /* ---- MOUSEMOVE (update preview) ---- */
//       window.addEventListener("mousemove", (ev) => {
//         if (!blurStart || !blurPreviewRef.current) return;
//         const x1 = blurStart.x;
//         const y1 = blurStart.y;
//         const x2 = ev.clientX;
//         const y2 = ev.clientY;
//         const left = Math.min(x1, x2);
//         const top = Math.min(y1, y2);
//         const w = Math.abs(x2 - x1);
//         const h = Math.abs(y2 - y1);
//         Object.assign(blurPreviewRef.current.style, {
//           left: `${left}px`,
//           top: `${top}px`,
//           width: `${w}px`,
//           height: `${h}px`,
//           display: w > 4 && h > 4 ? "block" : "none",
//         });
//       });

//       /* ---- MOUSEUP (finalise blur) ---- */
//       window.addEventListener(
//         "mouseup",
//         async (ev) => {
//           if (
//             !blurStart ||
//             creationModeRef.current !== "blur" ||
//             viewerModeRef.current !== "edit"
//           )
//             return;

//           const x1 = blurStart.x;
//           const y1 = blurStart.y;
//           const x2 = ev.clientX;
//           const y2 = ev.clientY;
//           const w = Math.abs(x2 - x1);
//           const h = Math.abs(y2 - y1);

//           if (w > 10 && h > 10) {
//             /* spherical for centre of rectangle */
//             const rect = viewer.container.getBoundingClientRect();
//             const centerX = x1 + (x2 - x1) / 2;
//             const centerY = y1 + (y2 - y1) / 2;
//             const { yaw, pitch } =
//               viewer.dataHelper.viewerCoordsToSphericalCoords({
//                 x: centerX - rect.left,
//                 y: centerY - rect.top,
//               }) || {};
//             if (yaw != null) {
//               await makeBlurMarker(yaw, pitch, w, h);
//             }
//           }

//           // cleanup preview
//           if (blurPreviewRef.current) {
//             blurPreviewRef.current.remove();
//             blurPreviewRef.current = null;
//           }
//           blurStart = null;
//         },
//         { passive: true }
//       );

//       /* ---------- Select-marker ---------- */
//       markersPluginRef.current.addEventListener("select-marker", (ev: any) => {
//         const viewerMarker: Marker = ev.marker;

//         /* 🌫️ BLUR delete handling */
//         if (
//           creationModeRef.current === "blur" &&
//           viewerMarker.data?.type === "blur"
//         ) {
//           const ok = confirm("Delete this blurred area?");
//           if (ok) {
//             removeMarkerLocal(viewerMarker.id);
//             const meta = {
//               ...(currentPanorama!.metadata || {}),
//               annotations:
//                 currentPanorama!.metadata?.annotations?.filter(
//                   (m: Marker) => m.id !== viewerMarker.id
//                 ) || [],
//             };
//             updatePanorama(currentPanorama!.id, { metadata: meta });
//             setCurrentPanorama((prev) =>
//               prev ? { ...prev, metadata: meta } : prev
//             );
//           }
//           return;
//         }

//         // (a) VIEW-MODE → navigate through nav pins
//         if (viewerModeRef.current === "view") {
//           if (
//             viewerMarker.data?.type === "navigation" &&
//             viewerMarker.data.targetPanoramaId
//           ) {
//             const dest = panoramas.find(
//               (p) => p.id === viewerMarker.data?.targetPanoramaId
//             );
//             if (dest) setCurrentPanorama(dest);
//           }
//           return;
//         }

//         // (b) EDIT-MODE → open only if it matches current creation mode
//         if (
//           (creationModeRef.current === "navigation" &&
//             viewerMarker.data?.type !== "navigation") ||
//           (creationModeRef.current === "annotation" &&
//             viewerMarker.data?.type === "navigation") ||
//           creationModeRef.current === "blur"
//         )
//           return;

//         // 👉 try to get the pristine marker kept in metadata
//         const pristine = currentPanorama?.metadata?.annotations?.find(
//           (m: Marker) => m.id === viewerMarker.id
//         );

//         openMarkerEditor(pristine ?? viewerMarker);
//         setIsPanoReady(true);
//       });
//     },
//     [currentPanorama, panoramas, isSharedView, creationMode]
//   );

//   /* ------------------------------------------------------------------
//    * Open marker editor modal
//    * ----------------------------------------------------------------*/
//   /* ------------------------------------------------------------------
//    * Open marker editor modal  ✅ NEW VERSION
//    * ----------------------------------------------------------------*/
//   const openMarkerEditor = (mk: Marker) => {
//     setEditingMarker(mk.id);

//     let txt = "";

//     /* 1️⃣ Navigation markers hold their value in data.targetPanoramaId */
//     if (mk.data?.type === "navigation") {
//       txt = mk.data.targetPanoramaId || "";
//     } else if (
//       /* 2️⃣ Normal annotation markers that correctly store tooltip.content */
//       mk.tooltip &&
//       typeof mk.tooltip === "object" &&
//       "content" in mk.tooltip &&
//       typeof (mk.tooltip as any).content === "string"
//     ) {
//       txt = (mk.tooltip as any).content;
//     } else if (typeof mk.html === "string") {
//       /* 3️⃣ Legacy markers: try to read plain text out of the raw HTML string */
//       const tmp = document.createElement("div");
//       tmp.innerHTML = mk.html;
//       txt = tmp.textContent?.trim() || "";
//     } else if (
//       /* 4️⃣ Fallback when tooltip has become an actual HTMLElement */
//       mk.tooltip &&
//       typeof mk.tooltip === "object" &&
//       (mk.tooltip as HTMLElement).textContent
//     ) {
//       const raw = (mk.tooltip as HTMLElement).textContent!.trim();
//       txt = raw.startsWith("[object") ? "" : raw;
//     }

//     setMarkerInput(txt);
//   };

//   /* ------------------------------------------------------------------
//    * Save marker changes
//    * ----------------------------------------------------------------*/
//   const handleSaveMarker = async () => {
//     if (!currentPanorama || !editingMarker || !markersPluginRef.current) return;

//     const list = currentPanorama.metadata?.annotations || [];
//     const target = list.find((m: Marker) => m.id === editingMarker);
//     if (!target) return;
//     const isNav = target.data?.type === "navigation";

//     if (isNav) {
//       markersPluginRef.current.updateMarker({
//         id: editingMarker,
//         data: { type: "navigation", targetPanoramaId: markerInput },
//       });
//       target.data = { type: "navigation", targetPanoramaId: markerInput };
//     } else {
//       markersPluginRef.current.updateMarker({
//         id: editingMarker,
//         tooltip: { content: markerInput },
//       });
//       target.tooltip = { content: markerInput };
//     }

//     const meta = { ...(currentPanorama.metadata || {}), annotations: list };
//     await updatePanorama(currentPanorama.id, { metadata: meta });
//     setCurrentPanorama({ ...currentPanorama, metadata: meta });
//     setEditingMarker(null);
//     setMarkerInput("");
//   };

//   /* ------------------------------------------------------------------
//    * Cancel editing → if marker is new & empty remove it
//    * ----------------------------------------------------------------*/
//   const handleCancelEdit = () => {
//     if (!editingMarker) return;

//     const ann = currentPanorama?.metadata?.annotations?.find(
//       (m: Marker) => m.id === editingMarker
//     );
//     const isEmptyNav =
//       ann?.data?.type === "navigation" && !ann.data.targetPanoramaId;
//     const isEmptyAnno =
//       !ann?.data?.type &&
//       (!ann?.tooltip ||
//         (typeof ann.tooltip === "object" &&
//           "content" in ann.tooltip &&
//           !(ann.tooltip as any).content));

//     if (isEmptyNav || isEmptyAnno) {
//       removeMarkerLocal(editingMarker);
//     }

//     setEditingMarker(null);
//     setMarkerInput("");
//   };

//   /* ------------------------------------------------------------------
//    * Delete marker completely (DB + local)
//    * ----------------------------------------------------------------*/
//   const handleDeleteMarker = async () => {
//     if (!currentPanorama || !editingMarker || !markersPluginRef.current) return;

//     removeMarkerLocal(editingMarker);

//     const meta = {
//       ...(currentPanorama.metadata || {}),
//       annotations:
//         currentPanorama.metadata?.annotations?.filter(
//           (m: Marker) => m.id !== editingMarker
//         ) || [],
//     };
//     await updatePanorama(currentPanorama.id, { metadata: meta });
//     setCurrentPanorama({ ...currentPanorama, metadata: meta });

//     setEditingMarker(null);
//     setMarkerInput("");
//   };

//   /* ------------------------------------------------------------------
//    * JSX
//    * ----------------------------------------------------------------*/
//   return (
//     <>
//       <style jsx global>{`
//         .psv-tooltip,
//         .psv-tooltip * {
//           color: #fff !important;
//         }

//         /* Annotation marker styles */
//         .annotation-marker {
//           width: 24px;
//           height: 24px;
//           position: relative;
//           transition: transform 0.2s ease;
//         }
//         .annotation-marker:hover {
//           transform: scale(1.2);
//         }
//         .annotation-marker-inner {
//           width: 100%;
//           height: 100%;
//           border-radius: 50%;
//           background: #ef4444;
//           border: 2px solid white;
//           box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
//         }

//         /* Navigation marker styles */
//         .navigation-marker {
//           width: 48px;
//           height: 48px;
//           position: relative;
//           transition: all 0.2s ease;
//         }
//         .navigation-marker:hover {
//           transform: scale(1.1);
//         }
//         .navigation-marker-inner {
//           width: 100%;
//           height: 100%;
//           border-radius: 50%;
//           background: transparent;
//           border: 8px solid rgba(209, 213, 219, 0.6);
//           box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
//           transform: perspective(200px) rotateX(20deg) scaleY(0.5);
//         }
//         .navigation-marker:hover .navigation-marker-inner {
//           border-color: rgba(209, 213, 219, 0.8);
//         }

//         /* === BLUR PATCH styles === */
//         .blur-marker {
//           backdrop-filter: blur(8px);
//           background: rgba(255, 255, 255, 0.2);
//           border: 2px solid rgba(255, 255, 255, 0.3);
//           border-radius: 4px;
//         }
//       `}</style>
//       <div className="flex flex-col h-screen">
//         {/* ---------------- Viewer Section ----------------*/}
//         <div className="flex-1 relative bg-gray-50">
//           {!isSharedView && (
//             <div className="absolute top-4 left-4 right-4 z-10 flex w-[calc(100%-2rem)] justify-between items-center">
//               {/* Left: Mode toggle */}
//               <button
//                 className={`px-3 py-1 rounded ${
//                   viewerMode === "edit"
//                     ? "bg-cyber-gradient text-white"
//                     : "bg-cyber-gradient"
//                 }`}
//                 onClick={() =>
//                   setViewerMode((m) => (m === "view" ? "edit" : "view"))
//                 }
//               >
//                 {viewerMode === "view" ? "Switch to Edit" : "Switch to View"}
//               </button>

//               {/* Right: Annotation controls */}
//               <div className="flex items-center space-x-2">
//                 {viewerMode === "edit" && (
//                   <>
//                     <button
//                       className={`px-3 py-1 rounded ${
//                         creationMode === "annotation"
//                           ? "bg-cyber-gradient text-white"
//                           : "bg-gray-200"
//                       }`}
//                       onClick={() => setCreationMode("annotation")}
//                     >
//                       Edit Annotation
//                     </button>
//                     <button
//                       className={`px-3 py-1 rounded ${
//                         creationMode === "navigation"
//                           ? "bg-cyber-gradient text-white"
//                           : "bg-gray-200"
//                       }`}
//                       onClick={() => setCreationMode("navigation")}
//                     >
//                       Edit Navigation
//                     </button>
//                     {/* === BLUR button === */}
//                     <button
//                       className={`px-3 py-1 rounded ${
//                         creationMode === "blur"
//                           ? "bg-cyber-gradient text-white"
//                           : "bg-gray-200"
//                       }`}
//                       onClick={() => setCreationMode("blur")}
//                     >
//                       Edit Blur
//                     </button>
//                   </>
//                 )}
//                 <button
//                   className="w-8 h-8 rounded-full border border-gray-300 bg-white text-lg font-bold text-gray-700 hover:bg-gray-100"
//                   onClick={() => setShowHelpModal(true)}
//                   title="How to Annotate"
//                 >
//                   ?
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* Help Modal */}
//           {showHelpModal && (
//             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//               <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
//                 <h2 className="text-xl font-bold mb-4">How to Annotate</h2>
//                 <p className="mb-4">
//                   <strong>Annotation Mode:</strong> Click anywhere to place a
//                   pin, then enter a text label.
//                 </p>
//                 <p className="mb-4">
//                   <strong>Navigation Mode:</strong> Place a navigation pin and
//                   select the destination panorama.
//                 </p>
//                 <p className="mb-4">
//                   <strong>Blur Mode:</strong> Click and drag to cover sensitive
//                   areas with a blur; click an existing blur to delete it.
//                 </p>
//                 <div className="flex justify-end">
//                   <button
//                     className="bg-cyber-gradient text-white px-4 py-2 rounded"
//                     onClick={() => setShowHelpModal(false)}
//                   >
//                     Got it
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Marker editor */}
//           {editingMarker && !isSharedView && (
//             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white border border-gray-300 p-4 rounded shadow-lg z-50 text-white">
//               <h3 className="font-bold mb-2">
//                 {currentPanorama?.metadata?.annotations?.find(
//                   (m: Marker) => m.id === editingMarker
//                 )?.data?.type === "navigation"
//                   ? "Edit Navigation Marker"
//                   : "Edit Marker Annotation"}
//               </h3>
//               {currentPanorama?.metadata?.annotations?.find(
//                 (m: Marker) => m.id === editingMarker
//               )?.data?.type === "navigation" ? (
//                 <div className="mb-3">
//                   <label className="block mb-1">Select Target Panorama:</label>
//                   <select
//                     className="w-full p-2 bg-gray-100 border border-gray-300 !text-black"
//                     value={markerInput}
//                     onChange={(e) => setMarkerInput(e.target.value)}
//                   >
//                     <option value="">Select a panorama</option>
//                     {panoramas
//                       .filter((p) => p.id !== currentPanorama?.id)
//                       .map((p) => (
//                         <option key={p.id} value={p.id}>
//                           {p.name || `Panorama ${p.id.slice(0, 4)}`}
//                         </option>
//                       ))}
//                   </select>
//                 </div>
//               ) : (
//                 <textarea
//                   className="w-64 h-32 bg-gray-100 border border-gray-300 p-2 mb-3 !text-black"
//                   value={markerInput}
//                   onChange={(e) => setMarkerInput(e.target.value)}
//                   placeholder="Enter annotation text..."
//                 />
//               )}
//               <div className="flex justify-between">
//                 <button
//                   className="px-3 py-1 bg-[#bd7581] text-white rounded"
//                   onClick={handleDeleteMarker}
//                 >
//                   Delete
//                 </button>
//                 <div>
//                   <button
//                     className="mr-2 px-3 py-1 bg-gray-300 rounded"
//                     onClick={handleCancelEdit}
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     className="px-3 py-1 bg-cyber-gradient text-white rounded"
//                     onClick={handleSaveMarker}
//                   >
//                     Save
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Photo Sphere */}
//           {currentPanorama ? (
//             <div className="relative w-full h-full">
//               <ReactPhotoSphereViewer
//                 key={currentPanorama.id}
//                 ref={photoViewerRef}
//                 src={currentPanorama.url || ""}
//                 height="100%"
//                 width="100%"
//                 plugins={[
//                   [
//                     MarkersPlugin,
//                     { markers: currentPanorama.metadata?.annotations || [] },
//                   ],
//                 ]}
//                 navbar={["zoom", "fullscreen"]}
//                 minFov={30}
//                 maxFov={90}
//                 onReady={initializeViewer}
//                 containerClass="psv-container"
//                 // loader property removed as it is not supported
//               />
//               {!isPanoReady && (
//                 <>
//                   <div className="psv-loading-spinner"></div>
//                   <div className="psv-loading-text">Loading Next 360°...</div>
//                 </>
//               )}
//             </div>
//           ) : (
//             <div className="flex items-center justify-center w-full h-full text-gray-500">
//               {isSharedView
//                 ? "Loading panorama..."
//                 : "Select a grid location to view its panorama"}
//             </div>
//           )}
//         </div>

//         {/* ---------------- Grid ----------------*/}
//         <div className="p-4 border-t border-gray-300 overflow-y-auto">
//           <h2 className="text-lg font-semibold mb-4">
//             {isSharedView ? "Navigation Map" : "Locations Grid"}
//           </h2>
//           {rows && cols ? (
//             <div
//               className="grid gap-3 place-items-center w-max mx-auto"
//               style={{
//                 gridTemplateRows: `repeat(${rows},120px)`,
//                 gridTemplateColumns: `repeat(${cols},120px)`,
//               }}
//             >
//               {Array.from({ length: rows }).flatMap((_, y) =>
//                 Array.from({ length: cols }).map((_, x) => {
//                   const node = getNodeAtPosition(x, y);
//                   const assigned = !!node?.panorama_id;
//                   const pano = assigned
//                     ? panoramas.find((p) => p.id === node?.panorama_id)
//                     : null;
//                   if (isSharedView && !assigned) return null;
//                   return (
//                     <div
//                       key={`${x}-${y}`}
//                       onClick={() => assigned && handleCellClick(x, y)}
//                       className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all ${
//                         assigned
//                           ? "border-blue-500 bg-blue-100 hover:bg-blue-200 cursor-pointer"
//                           : "border-dashed border-gray-300 bg-gray-200 cursor-not-allowed opacity-60"
//                       }`}
//                     >
//                       {pano ? (
//                         <>
//                           <img
//                             src={pano.thumbnail_url ?? pano.url ?? ""}
//                             alt="thumb"
//                             className="w-full h-full object-cover rounded-full"
//                           />
//                           {!!pano.metadata?.annotations?.length && (
//                             <div className="absolute -top-2 -right-2 bg-[#bd7581] text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
//                               {pano.metadata.annotations.length}
//                             </div>
//                           )}
//                         </>
//                       ) : (
//                         <span className="text-sm text-gray-500">
//                           Unassigned
//                         </span>
//                       )}
//                     </div>
//                   );
//                 })
//               )}
//             </div>
//           ) : (
//             <p className="text-gray-500">
//               {isSharedView
//                 ? "Navigation map is unavailable."
//                 : "No grid data."}
//             </p>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }
