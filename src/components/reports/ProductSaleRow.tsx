import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductSaleEntry } from '../../types';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface ProductSaleRowProps {
  sale: ProductSaleEntry;
  index: number;
  onQuantityChange: (productId: string, quantity: number) => void;
}

export const ProductSaleRow: React.FC<ProductSaleRowProps> = ({
  sale,
  index,
  onQuantityChange,
}) => {
  const handleIncrement = () => {
    onQuantityChange(sale.productId, sale.quantity + 1);
  };

  const handleDecrement = () => {
    onQuantityChange(sale.productId, Math.max(0, sale.quantity - 1));
  };

  const handleChange = (text: string) => {
    const num = parseInt(text, 10);
    onQuantityChange(sale.productId, isNaN(num) ? 0 : Math.max(0, num));
  };

  return (
    <View style={[styles.container, index % 2 === 0 && styles.evenRow]}>
      <View style={styles.indexContainer}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productNameUrdu} numberOfLines={1}>
          {sale.productNameUrdu}
        </Text>
        <Text style={styles.productNameEn} numberOfLines={1}>
          {sale.productName}
        </Text>
        <Text style={styles.unitText}>{sale.unit}</Text>
      </View>

      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={handleDecrement}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={16} color={colors.primary[500]} />
        </TouchableOpacity>

        <TextInput
          style={styles.quantityInput}
          value={sale.quantity.toString()}
          onChangeText={handleChange}
          keyboardType="numeric"
          selectTextOnFocus
        />

        <TouchableOpacity
          style={styles.quantityButton}
          onPress={handleIncrement}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.amountText, sale.amount > 0 && styles.amountActive]}>
          Rs. {sale.amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  evenRow: {
    backgroundColor: colors.gray[50],
  },
  indexContainer: {
    width: 30,
    alignItems: 'center',
  },
  indexText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  productInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productNameUrdu: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  productNameEn: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  unitText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    width: 45,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
  },
  amountContainer: {
    width: 80,
    alignItems: 'flex-end',
  },
  amountText: {
    ...typography.body,
    color: colors.text.muted,
  },
  amountActive: {
    color: colors.secondary[600],
    fontWeight: '600',
  },
});

export default ProductSaleRow;

