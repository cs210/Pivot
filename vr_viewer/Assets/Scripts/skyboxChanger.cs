using UnityEngine;

public class skyboxChanger : MonoBehaviour
{
    public Material mat = null;
    public void SetTexture()
    {
        Texture2D texture = Resources.Load<Texture2D>("Textures/" + gameObject.name);
        
        if (texture != null)
        {
            // Set the main texture of the material
            mat.mainTexture = texture;
            Debug.Log("Texture set successfully: " + gameObject.name);
        }
        else
        {
            Debug.LogError("Texture not found: " + gameObject.name);
        }
    }
}
