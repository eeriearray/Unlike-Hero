using UnityEngine;
using UnityEngine.Rendering;

namespace UnlikeHero.Karts
{
    public sealed class TrackThemeManager : MonoBehaviour
    {
        [SerializeField] TrackTheme initialTheme;
        [SerializeField] Transform environmentRoot;
        GameObject environment;
        void Start() { if (initialTheme != null) Apply(initialTheme); }
        public void Apply(TrackTheme theme)
        {
            if (theme == null) return;
            if (environment != null) { environment.SetActive(false); Destroy(environment); }
            if (theme.environmentPrefab != null)
                environment = Instantiate(theme.environmentPrefab, environmentRoot != null ? environmentRoot : transform);
            RenderSettings.skybox = theme.skybox;
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = theme.ambient;
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = theme.fog; RenderSettings.fogDensity = theme.fogDensity;
        }
    }
}
