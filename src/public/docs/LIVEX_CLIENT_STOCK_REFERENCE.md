# LIVEX OS — Mini-espace client / Gestion de stock

## Objectif
Livex Office Supplies est une plateforme B2B de vente de fournitures de bureau.

Les clients entreprises disposent d’un mini-espace pour suivre leur stock interne de fournitures achetées chez Livex.

Ce mini-espace doit rester simple au départ. Il ne faut pas encore ajouter la gestion des agences/sites.

## Fonctionnement actuel souhaité

Quand une entreprise commande chez Livex :
- les produits livrés alimentent son stock interne client ;
- le client peut ensuite faire des sorties de stock ;
- chaque sortie doit être liée à :
  - un article
  - une quantité
  - un département
  - un nom de signataire
  - une date
  - éventuellement une observation

## Niveau actuel de suivi
Pour l’instant, le suivi se fait uniquement au niveau :
- département
- article
- signataire
- période

Ne pas ajouter maintenant :
- agence
- site
- succursale
- multi-localisation

Mais le code doit rester extensible pour ajouter plus tard une dimension site/agence.

## Statistiques utiles à créer

Créer une page statistiques dans le mini-espace client.

Statistiques MVP à afficher :

1. Dépense totale du mois
- montant total consommé en valeur
- comparaison avec le mois précédent si possible

2. Top départements consommateurs
- classement des départements par montant consommé
- afficher aussi les quantités sorties

3. Top fournitures les plus coûteuses
- classement des articles par montant total consommé
- quantité totale sortie
- coût total

4. Évolution mensuelle des consommations
- total consommé par mois
- sur les 6 ou 12 derniers mois

5. Articles les plus sortis
- classement par quantité sortie

6. Signataires fréquents
- classement des signataires par nombre de sorties ou quantité totale récupérée
- rester neutre dans le wording, ne pas donner un ton accusateur

7. Alertes stock faible
- articles dont le stock actuel est inférieur ou égal au seuil minimum défini par le client

## Règles importantes

- Ne pas compliquer l’interface actuelle.
- Ne pas ajouter agence/site maintenant.
- Ne pas casser les pages existantes.
- Ne pas modifier les workflows de commande/livraison sauf si nécessaire.
- Les statistiques doivent être filtrables par période si possible.
- Les statistiques doivent être propres, lisibles, professionnelles.
- Le design doit rester cohérent avec l’interface Livex OS.
- Les montants doivent être affichés en Ariary.
- Les prix doivent être considérés TTC côté client.

## Préparation future

Prévoir le code de manière à pouvoir ajouter plus tard :
- site_id
- agence
- succursale
- comparaison entre agences

Mais ne pas l’implémenter maintenant.