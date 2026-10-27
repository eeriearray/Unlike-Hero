using UnityEngine;

namespace UnlikeHero.Karts
{
    [CreateAssetMenu(menuName = "Unlike Hero/Karts/Track Theme")]
    public sealed class TrackTheme : ScriptableObject
    {
        public string displayName = "Shattered Crown";
        [TextArea] public string artDirection = "Dark fantasy floating islands; shattered stone arenas, violet dark energy, layered atmospheric silhouettes inspired by platform fighter stages.";
        [Tooltip("Visuals only. Track collision, checkpoints and hazards stay outside this prefab.")]
        public GameObject environmentPrefab;
        public Material skybox;
        public Color ambient = new Color(0.12f, 0.10f, 0.22f);
        public Color fog = new Color(0.06f, 0.04f, 0.12f);
        [Min(0)] public float fogDensity = 0.012f;
    }
}
