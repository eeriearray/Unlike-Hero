using System.IO;
using UnityEditor;
using UnityEngine;

namespace UnlikeHero.Karts.Editor
{
    public static class CreateKartDefaults
    {
        [MenuItem("Unlike Hero/Karts/Create Default Assets")]
        public static void Create()
        {
            const string folder = "Assets/ArcadeKart/Data";
            Directory.CreateDirectory(folder);
            foreach (WeightClass weight in System.Enum.GetValues(typeof(WeightClass)))
            {
                string path = $"{folder}/{weight}.asset";
                if (File.Exists(path)) continue;
                var tuning = ScriptableObject.CreateInstance<KartTuning>();
                tuning.ApplyPreset(weight); AssetDatabase.CreateAsset(tuning, path);
            }
            if (!File.Exists($"{folder}/Items.asset"))
                AssetDatabase.CreateAsset(ScriptableObject.CreateInstance<ItemTable>(), $"{folder}/Items.asset");
            if (!File.Exists($"{folder}/ShatteredCrown.asset"))
                AssetDatabase.CreateAsset(ScriptableObject.CreateInstance<TrackTheme>(), $"{folder}/ShatteredCrown.asset");
            AssetDatabase.SaveAssets(); AssetDatabase.Refresh();
        }
    }
}
