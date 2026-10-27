using System;
using UnityEditor;
using UnityEngine;

namespace UnlikeHero.Karts.Editor
{
    // No test-framework package dependency. Runs actual ItemTable and AIManager code in the editor.
    public static class ValidateKartFoundation
    {
        [MenuItem("Unlike Hero/Karts/Validate Economy and Rubber Banding")]
        public static void Run()
        {
            var table = ScriptableObject.CreateInstance<ItemTable>();
            var light = ScriptableObject.CreateInstance<KartTuning>();
            var medium = ScriptableObject.CreateInstance<KartTuning>();
            var heavy = ScriptableObject.CreateInstance<KartTuning>();
            try
            {
                light.ApplyPreset(WeightClass.Light); medium.ApplyPreset(WeightClass.Medium); heavy.ApplyPreset(WeightClass.Heavy);
                Require(light.mass < medium.mass && medium.mass < heavy.mass, "Mass ordering");
                Require(light.topSpeed < medium.topSpeed && medium.topSpeed < heavy.topSpeed, "Top speed ordering");
                Require(light.acceleration > medium.acceleration && medium.acceleration > heavy.acceleration, "Acceleration ordering");
                Require(light.turnDegreesPerSecond > medium.turnDegreesPerSecond && medium.turnDegreesPerSecond > heavy.turnDegreesPerSecond, "Turn ordering");
                Require(ItemTable.Classify(1, 1) == PackBand.Front, "Solo band");
                Require(ItemTable.Classify(2, 2) == PackBand.Last, "Two-racer last-place priority");
                for (int count = 3; count <= 16; count++)
                {
                    Require(ItemTable.Classify(1, count) == PackBand.Front && ItemTable.Classify(2, count) == PackBand.Front, "Leaders' band");
                    Require(ItemTable.Classify(count, count) == PackBand.Last, "Last-place band");
                    for (int place = 3; place < count; place++) Require(ItemTable.Classify(place, count) == PackBand.Middle, "Middle band");
                }
                var rng = new System.Random(173);
                CheckDistribution(table, 1, rng, new[] { ItemKind.Trap, ItemKind.Bolt, ItemKind.Coin }, new[] { .45f, .35f, .20f });
                CheckDistribution(table, 4, rng, new[] { ItemKind.HomingBolt, ItemKind.TripleBolt, ItemKind.SpeedBoost }, new[] { .35f, .30f, .35f });
                CheckDistribution(table, 8, rng, new[] { ItemKind.Invincibility, ItemKind.Overdrive, ItemKind.LeaderHunter }, new[] { .30f, .40f, .30f });
                table.front.Clear(); Require(table.Roll(1, 8, rng) == ItemKind.Coin, "Empty-table fallback");
                table.front.Add(new ItemWeight(ItemKind.Trap, 0));
                Require(table.Roll(1, 8, rng) == ItemKind.Coin, "Zero-weight fallback");
                bool rejected = false;
                try { table.Roll(0, 8, rng); } catch (ArgumentOutOfRangeException) { rejected = true; }
                Require(rejected, "Invalid placement rejected");
                Require(AIManager.Correction(14, 15, 100) == 0, "Dead zone");
                Require(AIManager.Correction(1000, 15, 100) == 1, "Behind capped");
                Require(AIManager.Correction(-1000, 15, 100) == -1, "Ahead capped");
                Require(Mathf.Approximately(AIManager.Correction(57.5f, 15, 100), 0.5f), "Continuous distance ramp");
                Require(AIManager.Correction(200, 15, 10) == 1, "Invalid designer range remains bounded");
                Debug.Log("Kart foundation: presets, placements, 300,000 weighted rolls, fallbacks and rubber banding passed.");
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(table); UnityEngine.Object.DestroyImmediate(light);
                UnityEngine.Object.DestroyImmediate(medium); UnityEngine.Object.DestroyImmediate(heavy);
            }
        }
        static void CheckDistribution(ItemTable table, int place, System.Random rng, ItemKind[] expected, float[] probability)
        {
            const int samples = 100000;
            int[] counts = new int[expected.Length];
            for (int i = 0; i < samples; i++)
            {
                int slot = Array.IndexOf(expected, table.Roll(place, 8, rng));
                Require(slot >= 0, "Forbidden item in placement band"); counts[slot]++;
            }
            for (int i = 0; i < counts.Length; i++)
                Require(Mathf.Abs(counts[i] / (float)samples - probability[i]) < 0.01f, "Weighted distribution differs by >1 percentage point");
        }
        static void Require(bool condition, string message)
        { if (!condition) throw new InvalidOperationException("Kart validation failed: " + message); }
    }
}
