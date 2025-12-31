import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShopkeeperRecord } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface ShopRecordRowProps {
  record: ShopkeeperRecord;
  index: number;
  onUpdate: (id: string, data: Partial<ShopkeeperRecord>) => void;
  onRemove: (id: string) => void;
}

export const ShopRecordRow: React.FC<ShopRecordRowProps> = ({
  record,
  index,
  onUpdate,
  onRemove,
}) => {
  const handleCreditChange = (text: string) => {
    const num = parseFloat(text);
    onUpdate(record.id, { credit: isNaN(num) ? 0 : num });
  };

  const handleCashChange = (text: string) => {
    const num = parseFloat(text);
    onUpdate(record.id, { cashReceived: isNaN(num) ? 0 : num });
  };

  const handleNameChange = (text: string) => {
    onUpdate(record.id, { shopName: text });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <TextInput
          style={styles.nameInput}
          value={record.shopName}
          onChangeText={handleNameChange}
          placeholder="Shop Name"
          placeholderTextColor={colors.text.muted}
        />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(record.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldsContainer}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Credit</Text>
          <TextInput
            style={styles.fieldInput}
            value={record.credit.toString()}
            onChangeText={handleCreditChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.text.muted}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Cash Received</Text>
          <TextInput
            style={styles.fieldInput}
            value={record.cashReceived.toString()}
            onChangeText={handleCashChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.text.muted}
          />
        </View>
      </View>
    </View>
  );
};

interface AddShopRecordProps {
  onAdd: (record: Omit<ShopkeeperRecord, 'id'>) => void;
}

export const AddShopRecordButton: React.FC<AddShopRecordProps> = ({ onAdd }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [shopName, setShopName] = useState('');
  const [credit, setCredit] = useState('');
  const [cash, setCash] = useState('');

  const handleSubmit = () => {
    if (!shopName.trim()) return;

    onAdd({
      shopName: shopName.trim(),
      credit: parseFloat(credit) || 0,
      cashReceived: parseFloat(cash) || 0,
    });

    setShopName('');
    setCredit('');
    setCash('');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsAdding(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
        <Text style={styles.addButtonText}>Add Shopkeeper Record</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.addFormContainer}>
      <TextInput
        style={styles.addInput}
        value={shopName}
        onChangeText={setShopName}
        placeholder="Shop Name"
        placeholderTextColor={colors.text.muted}
        autoFocus
      />
      <View style={styles.addFieldsRow}>
        <TextInput
          style={[styles.addInput, styles.addInputHalf]}
          value={credit}
          onChangeText={setCredit}
          placeholder="Credit"
          keyboardType="numeric"
          placeholderTextColor={colors.text.muted}
        />
        <TextInput
          style={[styles.addInput, styles.addInputHalf]}
          value={cash}
          onChangeText={setCash}
          placeholder="Cash"
          keyboardType="numeric"
          placeholderTextColor={colors.text.muted}
        />
      </View>
      <View style={styles.addActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setIsAdding(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  indexText: {
    ...typography.captionMedium,
    color: colors.text.inverse,
  },
  nameInput: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  removeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  fieldsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldGroup: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[500],
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  addButtonText: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
  addFormContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  addInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  addFieldsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addInputHalf: {
    flex: 1,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text.muted,
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
  },
});

export default ShopRecordRow;

