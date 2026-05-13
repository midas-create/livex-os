# LIVEX OS — Business Workflow Reference

## 1. Vision du produit

Livex OS est une plateforme B2B de vente de fournitures de bureau destinée principalement aux entreprises.

La plateforme doit rester :
- simple ;
- rapide ;
- professionnelle ;
- opérationnelle ;
- facile à comprendre pour les commerciaux, magasiniers, livreurs et responsables administratifs.

Le système ne doit pas devenir un ERP lourd.

La priorité est :
- la fluidité opérationnelle ;
- la cohérence métier ;
- la clarté des workflows ;
- la fiabilité des stocks et paiements.

---

# 2. Structure générale de l’interface admin

## Sidebar officielle

- Tableau de bord

- Commandes
- Livraisons
- Recouvrement
- Trésorerie
- Achats

- Structure
  - Clients
  - Fournisseurs
  - Articles

- Stock
- Rapports

---

# 3. Philosophie générale des workflows

Chaque page doit avoir une mission claire.

## Commandes
Suivre les commandes clients avant livraison.

## Livraisons
Organiser les livraisons.

## Recouvrement
Suivre les factures livrées non payées.

## Trésorerie
Suivre les encaissements réels.

## Achats
Gérer les achats fournisseurs et entrées stock.

## Structure
Gérer les données principales :
- clients ;
- fournisseurs ;
- articles.

---

# 4. Workflow Commande Client

## Étape 1 — Le client passe commande

Le client :
- ajoute des produits au panier ;
- valide sa commande.

### Effets système

- création de la commande ;
- statut = pending ;
- création des lignes de commande ;
- aucun mouvement de stock physique ;
- aucun BL ;
- aucune facture.

---

## Étape 2 — Livex confirme la commande

Action admin :

"Confirmer la commande"

### Effets système

- vérification du stock disponible ;
- réservation du stock ;
- génération du BC ;
- calcul de la date prévue de livraison ;
- statut = confirmed.

### Rôle du BC

Le BC est un document interne destiné au magasinier.

Il sert à :
- préparer les produits ;
- organiser la commande ;
- préparer la future livraison.

---

# 5. Règles de livraison

## Calcul de la date prévue

### Si commande confirmée avant 12h
Livraison prévue le lendemain.

### Si commande confirmée après ou à partir de 12h
Livraison prévue le surlendemain.

Exemples :
- confirmation lundi 10h → livraison mardi ;
- confirmation lundi 15h → livraison mercredi.

---

# 6. Workflow Livraison

## Page Livraisons

Cette page sert à organiser les livraisons.

### Filtres principaux

- Aujourd’hui
- Demain
- En retard
- Toutes

---

## Informations affichées

- BC / commande ;
- client ;
- date prévue livraison ;
- montant ;
- statut paiement prévu ;
- action : Livrer.

---

## Action principale

Bouton officiel :

"Livrer"

Le terme "Expédier" ne doit pas être utilisé.

---

## Confirmation livraison

Modal :

"Livraison de la commande"

Bouton :

"Confirmer la livraison"

---

## Effets système à la livraison

Quand la livraison est confirmée :

- génération du BL ;
- génération de la facture ;
- impression BL + facture ;
- diminution du stock physique ;
- diminution du stock réservé ;
- insertion mouvement stock OUT ;
- mise à jour du stock client ;
- statut = delivered ou partially_delivered.

Le livreur part avec :
- les produits ;
- le BL ;
- la facture.

---

# 7. Workflow Paiement

## Important

Paiement ≠ Livraison.

Le paiement est enregistré seulement quand l’argent arrive réellement chez Livex.

Le livreur peut :
- récupérer espèces ;
- récupérer chèque ;
- recevoir preuve virement ;
- recevoir paiement mobile money.

Mais le paiement n’est enregistré dans le système qu’après régularisation chez Livex.

---

## Effets système paiement

Quand Livex reçoit réellement l’argent :

- insertion paiement ;
- mise à jour montant payé ;
- mise à jour statut paiement.

---

# 8. Workflow Recouvrement

## Règle fondamentale

Le recouvrement concerne uniquement :
- les factures livrées ;
- non payées.

Une commande non livrée ne doit jamais apparaître dans le recouvrement.

---

## La page Recouvrement affiche

- factures à échéance ;
- factures en retard ;
- factures partiellement payées.

---

## Informations affichées

- numéro facture ;
- client ;
- date livraison ;
- échéance ;
- montant ;
- restant dû ;
- jours retard.

---

# 9. Règles CA (Chiffre d’affaires)

Le chiffre d’affaires est reconnu uniquement à la livraison.

Pas :
- à la commande ;
- à la confirmation ;
- à la réservation.

Donc :

## Livraison confirmée
→ CA reconnu.

---

# 10. Workflow Stock

## Trois notions importantes

### Stock physique
Stock réellement présent dans le magasin.

### Stock réservé
Stock bloqué pour des commandes confirmées.

### Stock disponible

Formule :

available_stock = stock_quantity - reserved_quantity

---

## Règles officielles

| Étape | Stock physique | Stock réservé |
|---|---|---|
| commande client | inchangé | inchangé |
| confirmation admin | inchangé | augmente |
| livraison | diminue | diminue |

---

## Signification métier réservation

La réservation sert à empêcher qu’un autre client achète un stock déjà promis à une commande confirmée.

Le stock reste physiquement chez Livex jusqu’à la livraison.

---

# 11. Affichage stock catalogue

Le catalogue client doit afficher :

available_stock

et non :

stock_quantity brut.

Cela doit s’appliquer :
- cartes produits ;
- variantes ;
- panier ;
- badges disponibilité.

---

# 12. Documents officiels

## BC

Généré à la confirmation commande.

Usage :
- préparation magasin ;
- document interne.

---

## BL

Généré à la livraison.

Usage :
- preuve livraison ;
- document accompagnant les produits.

---

## Facture

Générée à la livraison.

La facture accompagne la livraison.

La facture n’attend pas le paiement.

---

# 13. Règles facture et paiement

## Clients paiement à livraison

La facture doit afficher :

"Paiement à la livraison"

Ne pas afficher :

"Impayé"

---

## Clients avec échéance

La facture doit afficher :

- "Non payé" ;
- date échéance.

---

## Calcul échéance

L’échéance commence à partir de la date de livraison.

Exemple :
- délai client = 15 jours ;
- livraison le 10 mai ;
- échéance = 25 mai.

---

# 14. Statuts officiels commandes

## pending
Commande client reçue.

## confirmed
Commande confirmée par Livex.
- BC généré ;
- stock réservé.

## partially_delivered
Livraison partielle effectuée.

## delivered
Commande totalement livrée.

## cancelled
Annulation exceptionnelle.

---

# 15. Règles UX / Interface

## Philosophie générale

L’interface doit rester :
- simple ;
- dense ;
- professionnelle ;
- lisible.

Éviter :
- trop de statuts ;
- trop de couleurs ;
- trop de boutons ;
- workflows complexes.

---

## KPI

Préférer :
- peu de KPI ;
- mais des KPI cohérents.

Éviter les cartes vides.

---

## Design

Le design doit être :
- premium ;
- moderne ;
- compact ;
- cohérent.

Le branding Livex doit être visible dans tout le back-office.

---

# 16. Fournisseurs

Les fournisseurs doivent être une vraie entité structurée.

Ne pas saisir les fournisseurs manuellement en texte libre dans les achats.

---

## Informations fournisseur

- nom ;
- téléphone ;
- email ;
- adresse ;
- NIF ;
- contact ;
- délai paiement ;
- observations.

---

## Objectifs futurs fournisseurs

Permettre :
- rapports achats fournisseur ;
- dettes fournisseurs ;
- historique achats ;
- évolution prix ;
- top fournisseurs.

---

# 17. Objectif produit

Livex OS doit devenir :
- un outil commercial ;
- un outil opérationnel ;
- un outil de pilotage ;
- mais rester simple à utiliser.

Le système doit donner une sensation :
- professionnelle ;
- fluide ;
- crédible ;
- maîtrisée.

Il ne doit jamais donner l’impression d’un ERP lourd ou confus.

