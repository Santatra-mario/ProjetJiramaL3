import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Styles optimisés pour format A4 strict 1 page (595.28 x 841.89 pt)
const styles = StyleSheet.create({
  page: {
    width: 595.28,
    height: 841.89,
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 35,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1e293b',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0284c7',
    paddingBottom: 10,
    marginBottom: 15,
  },
  logoContainer: {
    flexDirection: 'column',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0284c7',
    letterSpacing: 1,
  },
  subLogoText: {
    fontSize: 8,
    color: '#0369a1',
    marginTop: 2,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#0f172a',
    textAlign: 'right',
  },
  docMeta: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 3,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoBox: {
    width: '48%',
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  label: {
    color: '#64748b',
  },
  value: {
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginVertical: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontWeight: 'bold',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  colDesc: { width: '35%' },
  colAncien: { width: '15%', textAlign: 'right' },
  colNouveau: { width: '15%', textAlign: 'right' },
  colConso: { width: '15%', textAlign: 'right' },
  colTarif: { width: '20%', textAlign: 'right' },

  totalSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
  totalBox: {
    width: '40%',
    backgroundColor: '#f0f9ff',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalGrand: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0369a1',
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
    paddingTop: 4,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7.5,
    color: '#94a3b8',
  },
  pageNumber: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0284c7',
  }
});

export const RelevePdfDocument = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* En-tête */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>JIRAMA</Text>
          <Text style={styles.subLogoText}>Eau & Électricité de Madagascar</Text>
        </View>
        <View>
          <Text style={styles.docTitle}>RELEVÉ DE CONSOMMATION</Text>
          <Text style={styles.docMeta}>N° Relevé : {data.id}</Text>
          <Text style={styles.docMeta}>Date d'émission : {data.dateReleve}</Text>
        </View>
      </View>

      {/* Informations Client & Compteur */}
      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <Text style={styles.boxTitle}>ABONNÉ</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nom :</Text>
            <Text style={styles.value}>{data.Abonne}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Réf. Client :</Text>
            <Text style={styles.value}>{data.clientRef}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Adresse :</Text>
            <Text style={styles.value}>{data.adresse}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.boxTitle}>COMPTEUR</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>N° Compteur :</Text>
            <Text style={styles.value}>{data.compteurNum}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Type :</Text>
            <Text style={styles.value}>{data.type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Période :</Text>
            <Text style={styles.value}>{data.periode}</Text>
          </View>
        </View>
      </View>

      {/* Tableau des Index */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Désignation</Text>
          <Text style={styles.colAncien}>Ancien Index</Text>
          <Text style={styles.colNouveau}>Nouveau Index</Text>
          <Text style={styles.colConso}>Conso ({data.type === 'Eau' ? 'm³' : 'kWh'})</Text>
          <Text style={styles.colTarif}>Montant HT (Ar)</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={styles.colDesc}>Consommation {data.type}</Text>
          <Text style={styles.colAncien}>{data.ancienIndex}</Text>
          <Text style={styles.colNouveau}>{data.nouveauIndex}</Text>
          <Text style={styles.colConso}>{data.consommation}</Text>
          <Text style={styles.colTarif}>{data.montantHT.toLocaleString()} Ar</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={styles.colDesc}>Redevance fixe / Entretien</Text>
          <Text style={styles.colAncien}>-</Text>
          <Text style={styles.colNouveau}>-</Text>
          <Text style={styles.colConso}>-</Text>
          <Text style={styles.colTarif}>{data.redevance.toLocaleString()} Ar</Text>
        </View>
      </View>

      {/* Total & Échéance */}
      <View style={styles.totalSection}>
        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.label}>Total HT :</Text>
            <Text style={styles.value}>{(data.montantHT + data.redevance).toLocaleString()} Ar</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.label}>TVA (20%) :</Text>
            <Text style={styles.value}>{data.tva.toLocaleString()} Ar</Text>
          </View>
          <View style={[styles.totalRow, styles.totalGrand]}>
            <Text style={{ fontWeight: 'bold', color: '#0369a1' }}>NET À PAYER :</Text>
            <Text style={{ fontWeight: 'bold', color: '#0369a1' }}>{data.totalTTC.toLocaleString()} Ar</Text>
          </View>
        </View>
      </View>

      {/* Date limite */}
      <View style={{ marginTop: 15, padding: 8, backgroundColor: '#fef3c7', borderRadius: 4 }}>
        <Text style={{ color: '#92400e', textAlign: 'center', fontWeight: 'bold' }}>
          Date limite de paiement : {data.dateLimite}
        </Text>
      </View>

      {/* Pied de page strict (Page 1/1) */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>JIRAMA Madagascar - Service Clientèle - Contact : 020 22 222 11</Text>
        <Text style={styles.pageNumber}>Page 1 sur 1</Text>
      </View>
    </Page>
  </Document>
);