"""
demo code for stitching
need to install numpy and opencv-python

bugs/quirks:
- supports most common filetypes (jpg, jpeg, png, tif, tiff, webp, etc): see opencv-python docs
- does NOT support heif files
"""
import cv2
import time
import os

def stitch(dirname, display=False):
    """
    :param dirname: path to a directory containing the images to be stitched.
    :return: none
    """
    start = time.time()
    print("Got it, stitching your images now...\n")

    filenames = [f"{dirname}/{filename}" for filename in os.listdir(dirname)]
    images = [cv2.imread(filename) for filename in filenames]

    # cv2.imread(filename) returns None if filename points to a non-image file,
    # or a filetype it cannot support. so we remove these.
    images = [image for image in images if image is not None]

    # ensure OpenCV version compatibility
    stitcher = cv2.Stitcher_create() if int(cv2.__version__[0]) >= 4 else cv2.createStitcher()

    # this line is what actually does the stitching
    status, panorama = stitcher.stitch(images)
    if status != cv2.Stitcher_OK:
        print("Error during stitching:", status)
        return

    # save the result
    cv2.imwrite(f"panorama-{dirname}.jpg", panorama)

    end = time.time()

    # show the result
    if display:
        cv2.imshow("Panorama", panorama)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

    print(f"Stitching {len(images)} images took {end - start} seconds!")
    print(f"The stitched panorama has been saved as {dirname}-panorama.jpg.")


if __name__ == "__main__":

    print("\nWelcome to Jun's stitching demo!")
    print("So you wanna make a panorama? First, put all the individual images into a directory.")
    dirname = input("Now, specify the path to that directory containing your images (or 0 to quit):")

    if dirname != "0" and dirname != "q":
        stitch(dirname)
    else:
        print("Thank you!")