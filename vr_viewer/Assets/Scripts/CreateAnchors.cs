using UnityEngine;
using Unity.XR.CoreUtils;
using System.Collections.Generic;

public class CreateAnchors : MonoBehaviour
{
    private List<Vector3> AchorPositions = new List<Vector3>()
    {
        new Vector2(0, 1),
        new Vector2(2, 1),
        new Vector2(-2, 1),
    };

    void Start()
    {
        if (transform.childCount > 0)
        {
            Transform firstChild = transform.GetChild(0); // Get the first child
            if (firstChild != null)
            {
                XROrigin xrOrigin = FindFirstObjectByType<XROrigin>();
                float floorY = (xrOrigin != null) ? xrOrigin.CameraFloorOffsetObject.transform.position.y : 0f;
                for (int i = 0; i < AchorPositions.Count; i++)
                {
                    // Create a sphere
                    GameObject sphere = Instantiate(firstChild.gameObject, new Vector3(AchorPositions[i].x, floorY, AchorPositions[i].y), Quaternion.identity);
                    sphere.SetActive(true);
                    // Set a unique name
                    sphere.name = "Anchor" + i;
                    sphere.transform.SetParent(transform, true); // 'true' keeps world position
                }
            }
        }
        else
        {
            Debug.LogWarning("Add the example Anchor");
        }
    }
}
