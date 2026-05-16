
console.log("\n" + "=".repeat(60));
console.log("⚠️  PRÉPARATION DE LA COMPILATION (BUILD)  ⚠️");
console.log("=".repeat(60));
console.log("\nCe processus va effectuer les opérations suivantes :");
console.log("1. Téléchargement des dépendances Node.js (via npm)");
console.log("2. Téléchargement et compilation des bibliothèques Rust (via Cargo)");
console.log("3. Génération de l'installateur Windows (.exe / .msi)");
console.log("\n📦 TAILLE ESTIMÉE DES TÉLÉCHARGEMENTS : ~500 MB");
console.log("💡 NOTE : Si vous utilisez une connexion mobile (données mobiles),");
console.log("   assurez-vous d'avoir un forfait suffisant avant de continuer.");
console.log("\nDébut du build dans 5 secondes...\n");
console.log("=".repeat(60) + "\n");

setTimeout(() => {
  process.exit(0);
}, 5000);
