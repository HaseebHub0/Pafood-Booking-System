import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useOrderStore,
  useInvoiceStore,
  useAuthStore,
  useShopStore,
  useDeliveryStore,
} from '../../../src/stores';
import { Button, Card, Badge, LoadingSpinner } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { Order, OrderStatus } from '../../../src/types/order';

// Check if order can be delivered (KPO has approved and generated load form)
const canDeliver = (status: OrderStatus): boolean => {
  return status === 'load_form_ready' || status === 'assigned';
};

// Get display-friendly status label
const getStatusLabel = (status: OrderStatus): string => {
  switch (status) {
    case 'submitted': return 'PENDING APPROVAL';
    case 'finalized': return 'APPROVED';
    case 'billed': return 'BILLED';
    case 'load_form_ready':
    case 'assigned': return 'READY TO DELIVER';
    case 'delivered': return 'DELIVERED';
    default: return status.toUpperCase();
  }
};

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, updateOrderStatus, loadOrders } = useOrderStore();
  const { generateInvoiceFromOrder } = useInvoiceStore();
  const { user } = useAuthStore();
  const { getShopById, shops } = useShopStore();
  const { deliveries, loadDeliveries, getDeliveryById, markDelivered, adjustDeliveryPayment } = useDeliveryStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [collectedAmount, setCollectedAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustedAmount, setAdjustedAmount] = useState('');

  const isSalesman = user?.role?.toLowerCase() === 'salesman';

  // Load deliveries on mount
  useEffect(() => {
    loadDeliveries();
  }, []);

  // Find delivery by ID first (id is delivery ID, not order ID)
  const delivery = useMemo(() => {
    return getDeliveryById(id);
  }, [deliveries, id]);

  // Find the order associated with this delivery
  const order = useMemo(() => {
    if (delivery?.orderId) {
      const foundOrder = orders.find(o => o.id === delivery.orderId);
      if (foundOrder) return foundOrder;
    }
    // Fallback: if no delivery found, try finding order by ID directly (for backward compatibility)
    // This allows the screen to work if someone navigates with an order ID instead of delivery ID
    const foundOrder = orders.find(o => o.id === id);
    if (foundOrder && !isSalesman) {
      // Non-salesmen accessing by order ID should be redirected to order detail
      return null; // Will trigger redirect
    }
    return foundOrder;
  }, [orders, delivery, id, isSalesman]);

  // Reload orders and deliveries if not found
  useEffect(() => {
    if (!order && id) {
      loadOrders();
      loadDeliveries();
    }
  }, [order, id]);

  // Set default amount to full when order is available
  useEffect(() => {
    if (order && !collectedAmount && order.grandTotal) {
      setCollectedAmount(order.grandTotal.toString());
    }
  }, [order?.id, order?.grandTotal, collectedAmount]);

  // Restrict access: Only salesmen should access delivery detail screen
  if (isSalesman && !delivery) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Delivery not found</Text>
        <Text style={styles.notFoundSubtext}>This delivery may not exist or has been removed</Text>
        <Button 
          title="Go to Home" 
          onPress={() => router.replace('/(tabs)/')} 
          variant="outline" 
        />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Order not found</Text>
        <Text style={styles.notFoundSubtext}>This order may not exist or has been removed</Text>
        <Button 
          title="Go Back" 
          onPress={() => {
            // Role-based back navigation
            if (isSalesman) {
              router.replace('/(tabs)/');
            } else {
              router.back();
            }
          }} 
          variant="outline" 
        />
      </View>
    );
  }

  // Restrict access: Only salesmen should access delivery detail screen from home
  // Other roles (booker, KPO) should use order detail screen
  if (!isSalesman && delivery) {
    // Redirect non-salesmen to order detail if they somehow accessed delivery detail
    router.replace(`/(tabs)/orders/${delivery.orderId}`);
    return null;
  }

  const shop = getShopById(order.shopId);
  const isReady = canDeliver(order.status);
  const numCollectedAmount = parseFloat(collectedAmount) || 0;

  const handleMarkDelivered = async () => {
    console.log('handleMarkDelivered called', { isReady, delivery: !!delivery, order: !!order });
    
    if (!isReady || !delivery) {
      Alert.alert('Cannot Deliver', 'This order has not been approved by KPO yet.');
      return;
    }

    if (!order) {
      Alert.alert('Error', 'Order not found');
      return;
    }

    const totalAmt = order.grandTotal;
    console.log('Total amount:', totalAmt, 'Collected amount:', collectedAmount, 'Parsed:', numCollectedAmount);

    // Default to full amount if nothing entered or invalid
    let finalAmount = numCollectedAmount;
    if (!collectedAmount || collectedAmount.trim() === '' || isNaN(numCollectedAmount) || numCollectedAmount < 0) {
      finalAmount = totalAmt; // Default to full payment
      console.log('Defaulting to full amount:', finalAmount);
      setCollectedAmount(totalAmt.toString()); // Update the input field
    }

    // Validate amount doesn't exceed total
    if (finalAmount > totalAmt) {
      Alert.alert('Invalid Amount', `Payment amount (Rs. ${finalAmount.toLocaleString()}) cannot exceed total amount (Rs. ${totalAmt.toLocaleString()})`);
      return;
    }

    // Show confirmation for partial payment
    if (finalAmount > 0 && finalAmount < totalAmt) {
      const remaining = totalAmt - finalAmount;
      console.log('Showing partial payment confirmation dialog');
      
      // Use window.confirm for web, Alert.alert for native
      if (Platform.OS === 'web') {
        const message = `Total Amount: Rs. ${totalAmt.toLocaleString()}\nCollected: Rs. ${finalAmount.toLocaleString()}\nRemaining: Rs. ${remaining.toLocaleString()}\n\nThis will create an outstanding balance. Continue?`;
        const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(message) : false;
        if (confirmed) {
          console.log('User confirmed partial payment (web), processing:', finalAmount);
          processDelivery(finalAmount).catch((error) => {
            console.error('Error in processDelivery (partial):', error);
            alert('Error: ' + (error.message || 'Failed to process delivery. Please try again.'));
          });
        } else {
          console.log('User cancelled partial payment (web)');
        }
        return;
      }
      
      Alert.alert(
        'Confirm Partial Payment',
        `Total Amount: Rs. ${totalAmt.toLocaleString()}\nCollected: Rs. ${finalAmount.toLocaleString()}\nRemaining: Rs. ${remaining.toLocaleString()}\n\nThis will create an outstanding balance. Continue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => console.log('User cancelled partial payment') },
          { 
            text: 'Confirm', 
            onPress: () => {
              console.log('User confirmed partial payment, processing:', finalAmount);
              processDelivery(finalAmount).catch((error) => {
                console.error('Error in processDelivery (partial):', error);
                Alert.alert('Error', error.message || 'Failed to process delivery. Please try again.');
              });
            }
          },
        ],
        { cancelable: true }
      );
      return;
    }

    // Show confirmation for full payment
    if (finalAmount >= totalAmt) {
      console.log('Showing full payment confirmation dialog, finalAmount:', finalAmount, 'totalAmt:', totalAmt);
      
      // Use window.confirm for web, Alert.alert for native
      if (Platform.OS === 'web') {
        const message = `Total Amount: Rs. ${totalAmt.toLocaleString()}\nCollected: Rs. ${finalAmount.toLocaleString()}\n\n⚠️ IMPORTANT: This will mark the order as FULLY PAID.\n\nPlease verify that you have collected the complete amount from the shop owner.\n\nIf the shop owner paid less, please cancel and enter the actual amount collected.\n\nContinue?`;
        const confirmed = typeof window !== 'undefined' && window.confirm ? window.confirm(message) : false;
        if (confirmed) {
          console.log('User confirmed full payment (web), processing:', finalAmount);
          processDelivery(finalAmount).catch((error) => {
            console.error('Error in processDelivery (full):', error);
            alert('Error: ' + (error.message || 'Failed to process delivery. Please try again.'));
          });
        } else {
          console.log('User cancelled full payment (web)');
        }
        return;
      }
      
      Alert.alert(
        'Confirm Full Payment',
        `Total Amount: Rs. ${totalAmt.toLocaleString()}\nCollected: Rs. ${finalAmount.toLocaleString()}\n\n⚠️ IMPORTANT: This will mark the order as FULLY PAID.\n\nPlease verify that you have collected the complete amount from the shop owner.\n\nIf the shop owner paid less, please cancel and enter the actual amount collected.\n\nContinue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => console.log('User cancelled full payment') },
          { 
            text: 'Yes, Full Payment Received', 
            onPress: () => {
              console.log('User confirmed full payment, processing:', finalAmount);
              processDelivery(finalAmount).catch((error) => {
                console.error('Error in processDelivery (full):', error);
                Alert.alert('Error', error.message || 'Failed to process delivery. Please try again.');
              });
            }
          },
        ],
        { cancelable: true }
      );
      return;
    }

    // For unpaid (0), proceed directly
    console.log('Processing delivery with amount:', finalAmount);
    processDelivery(finalAmount).catch((error) => {
      console.error('Error in processDelivery (unpaid):', error);
      Alert.alert('Error', error.message || 'Failed to process delivery. Please try again.');
    });
  };

  const processDelivery = async (amount: number) => {
    console.log('processDelivery called', { deliveryId: delivery?.id, orderId: order?.id, amount, notes });
    
    if (!delivery) {
      console.error('processDelivery: No delivery found');
      Alert.alert('Error', 'Delivery not found');
      setIsProcessing(false);
      return;
    }

    if (!order) {
      console.error('processDelivery: No order found');
      Alert.alert('Error', 'Order not found');
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Calling markDelivered with:', { id: delivery.id, amount, totalAmount: delivery.totalAmount, notes });
      // Mark delivery as delivered with payment amount
      const success = await markDelivered(delivery.id, amount, undefined, notes);
      console.log('markDelivered result:', success);
      
      if (!success) {
        console.error('markDelivered returned false');
        Alert.alert('Error', 'Failed to mark delivery as delivered. Please try again.');
        setIsProcessing(false);
        return;
      }
      
      // Also update order status to delivered
      try {
        console.log('Updating order status to delivered:', order.id);
        await updateOrderStatus(order.id, 'delivered', {
          cashAmount: amount,
          creditAmount: 0,
          paymentMode: 'cash',
        });
        console.log('Order status updated successfully');
      } catch (orderError) {
        console.error('Failed to update order status:', orderError);
        // Continue even if order update fails
      }

      // Generate invoice automatically
      try {
        console.log('Generating invoice for order:', order.id);
        await generateInvoiceFromOrder(order.id);
        console.log('Invoice generated successfully');
      } catch (invoiceError) {
        console.warn('Invoice generation failed:', invoiceError);
      }

      const remaining = order.grandTotal - amount;
      
      // Show toast message (only on native platforms)
      if (Platform.OS !== 'web') {
        try {
          const Toast = require('react-native-toast-message').default;
          const toastMessage = remaining > 0
            ? `Collected: Rs. ${amount.toLocaleString()}, Remaining: Rs. ${remaining.toLocaleString()}`
            : `Cash received: Rs. ${amount.toLocaleString()}`;
          
          Toast.show({
            type: 'success',
            text1: 'Delivery Successful',
            text2: toastMessage,
            position: 'top',
            visibilityTime: 3000,
          });
        } catch (toastError) {
          console.warn('Toast not available:', toastError);
          // Fallback to Alert if Toast is not available
          Alert.alert(
            'Success',
            remaining > 0
              ? `Order delivered!\n\nCollected: Rs. ${amount.toLocaleString()}\nRemaining: Rs. ${remaining.toLocaleString()}`
              : `Order delivered successfully!\n\nCash received: Rs. ${amount.toLocaleString()}`
          );
        }
      }

      // Reset form
      setCollectedAmount('');
      setNotes('');
      
      // Reload deliveries to update pending count
      await Promise.all([loadOrders(), loadDeliveries()]);
      
      // Auto-close and navigate back after a short delay to show toast
      console.log('Navigation: isSalesman =', isSalesman);
      setTimeout(() => {
        console.log('Navigating back...');
        if (isSalesman) {
          router.replace('/(tabs)/');
        } else {
          router.back();
        }
      }, Platform.OS === 'web' ? 100 : 500);
    } catch (error) {
      console.error('Error in processDelivery:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update delivery';
      Alert.alert('Error', errorMessage);
      setIsProcessing(false);
    }
  };

  const handleMarkNotDelivered = () => {
    if (!isReady) {
      Alert.alert('Cannot Update', 'This order has not been approved by KPO yet.');
      return;
    }

    Alert.alert(
      'Mark as Not Delivered',
      'Are you sure you want to mark this order as failed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // For now, we'll keep the order in its current state
              // In a full implementation, you might want a 'failed' status
              Alert.alert('Note', 'Order marked as not delivered. Please contact KPO for next steps.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to update order status');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleGenerateInvoice = async () => {
    setIsProcessing(true);
    try {
      const invoice = await generateInvoiceFromOrder(order.id);
      if (invoice) {
        Alert.alert('Success', 'Invoice generated successfully!', [
          {
            text: 'View Invoice',
            onPress: () => router.push(`/(tabs)/invoices/${invoice.id}`),
          },
          { text: 'OK' },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invoice');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Header */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <Text style={styles.shopName}>{order.shopName}</Text>
              <Text style={styles.shopOwner}>{shop?.ownerName || 'Shop Owner'}</Text>
            </View>
            <Badge
              label={getStatusLabel(order.status)}
              variant={
                order.status === 'delivered'
                  ? 'success'
                  : isReady
                  ? 'info'
                  : order.status === 'finalized'
                  ? 'warning'
                  : 'default'
              }
              size="md"
            />
          </View>

          {/* Shop Details */}
          <View style={styles.shopDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={16} color={colors.text.muted} />
              <Text style={styles.detailText}>{shop?.address || order.notes || 'No address'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={16} color={colors.text.muted} />
              <Text style={styles.detailText}>{shop?.phone || 'No phone'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={colors.text.muted} />
              <Text style={styles.detailText}>
                Created: {new Date(order.createdAt).toLocaleDateString('en-PK')}
              </Text>
            </View>
          </View>

          {/* Show warning if not ready */}
          {!isReady && order.status !== 'delivered' && (
            <View style={styles.warningBanner}>
              <Ionicons name="time-outline" size={18} color={colors.warning} />
              <Text style={styles.warningText}>
                {order.status === 'submitted' 
                  ? 'Waiting for KPO approval' 
                  : order.status === 'finalized'
                  ? 'Approved - waiting for load form'
                  : order.status === 'billed'
                  ? 'Billed - waiting for dispatch'
                  : 'Not ready for delivery'}
              </Text>
            </View>
          )}
        </Card>

        {/* Order Items */}
        <Text style={styles.sectionTitle}>Items ({order.items.length})</Text>
        {order.items.map((item, index) => (
          <Card key={index} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemQuantity}>
                {item.quantity} {item.unit || 'pcs'}
              </Text>
            </View>
            <View style={styles.itemFooter}>
              <Text style={styles.itemPrice}>
                Rs. {item.unitPrice.toLocaleString()} × {item.quantity}
              </Text>
              <Text style={styles.itemTotal}>
                Rs. {item.lineTotal.toLocaleString()}
              </Text>
            </View>
            {!isSalesman && item.discountPercent > 0 && (
              <Text style={styles.itemDiscount}>Discount: {item.discountPercent}%</Text>
            )}
          </Card>
        ))}

        {/* Order Total */}
        <Card style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>Rs. {order.subtotal.toLocaleString()}</Text>
          </View>
          {!isSalesman && order.totalDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, { color: colors.error }]}>
                -Rs. {order.totalDiscount.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>Rs. {order.grandTotal.toLocaleString()}</Text>
          </View>
          <View style={styles.paymentModeRow}>
            <Text style={styles.paymentModeLabel}>Payment Mode:</Text>
            <Badge 
              label={order.paymentMode?.toUpperCase() || 'CASH'} 
              variant={order.paymentMode === 'credit' ? 'warning' : 'success'}
              size="sm"
            />
          </View>
        </Card>

        {/* Payment Info - Cash-only system with partial payment support */}
        {isReady && order.status !== 'delivered' && (
          <Card style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>Payment Collection</Text>
            <Text style={[styles.label, { marginBottom: 12, color: colors.text.muted }]}>
              Total Amount: Rs. {order.grandTotal.toLocaleString()}
            </Text>
            
            {/* Payment Amount Input */}
            <View style={styles.paymentInputContainer}>
              <Text style={styles.paymentInputLabel}>Amount Collected Now (Rs.)</Text>
              <TextInput
                style={styles.paymentInput}
                value={collectedAmount}
                onChangeText={(text) => {
                  // Only allow numbers and one decimal point
                  const filtered = text.replace(/[^0-9.]/g, '');
                  const parts = filtered.split('.');
                  if (parts.length <= 2) {
                    setCollectedAmount(filtered);
                  }
                }}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                editable={!isProcessing}
              />
              <View style={styles.quickAmountButtons}>
                <TouchableOpacity
                  style={[styles.quickAmountButton, numCollectedAmount === order.grandTotal && styles.quickAmountButtonActive]}
                  onPress={() => setCollectedAmount(order.grandTotal.toString())}
                  disabled={isProcessing}
                >
                  <Text style={[styles.quickAmountText, numCollectedAmount === order.grandTotal && styles.quickAmountTextActive]}>
                    Full (Rs. {order.grandTotal.toLocaleString()})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment Summary */}
            {collectedAmount && !isNaN(numCollectedAmount) && numCollectedAmount >= 0 && (
              <View style={styles.paymentSummary}>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Collected:</Text>
                  <Text style={[styles.paymentSummaryValue, { color: colors.success }]}>
                    Rs. {numCollectedAmount.toLocaleString()}
                  </Text>
                </View>
                {numCollectedAmount < order.grandTotal && (
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Remaining:</Text>
                    <Text style={[styles.paymentSummaryValue, { color: colors.warning }]}>
                      Rs. {(order.grandTotal - numCollectedAmount).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        )}

        {/* Delivered Status Info */}
        {order.status === 'delivered' && delivery && (
          <Card style={styles.paymentInfoCard}>
            <View style={styles.paymentInfoRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.paymentInfoText}>
                Order Delivered Successfully
              </Text>
            </View>
            <Text style={styles.paymentModeText}>
              Payment Mode: CASH
            </Text>
            <View style={styles.paymentDetailsRow}>
              <Text style={styles.paymentTime}>
                Total Amount: Rs. {order.grandTotal.toLocaleString()}
              </Text>
              <Text style={styles.paymentTime}>
                Cash Received: Rs. {(delivery.paidAmount || order.cashAmount || order.grandTotal || 0).toLocaleString()}
              </Text>
              {delivery.paymentStatus === 'PAID' && delivery.paidAmount === order.grandTotal && (
                <Text style={[styles.paymentTime, { color: colors.success, fontWeight: '600' }]}>
                  Status: Fully Paid
                </Text>
              )}
              {(delivery.paymentStatus === 'PARTIAL' || delivery.paymentStatus === 'UNPAID') && delivery.remainingBalance && (
                <Text style={[styles.paymentTime, { color: colors.warning, fontWeight: '600' }]}>
                  Remaining: Rs. {delivery.remainingBalance.toLocaleString()}
                </Text>
              )}
            </View>
            
            {/* Payment Adjustment Button - Only show if fully paid */}
            {isSalesman && delivery.paymentStatus === 'PAID' && delivery.paidAmount === order.grandTotal && (
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => {
                  setAdjustedAmount(delivery.paidAmount?.toString() || order.grandTotal.toString());
                  setShowAdjustmentModal(true);
                }}
              >
                <Ionicons name="pencil" size={18} color={colors.warning} />
                <Text style={styles.adjustButtonText}>Adjust Payment Amount</Text>
              </TouchableOpacity>
            )}

            {/* Payment History */}
            {delivery.paymentHistory && delivery.paymentHistory.length > 0 && (
              <View style={styles.paymentHistorySection}>
                <Text style={styles.paymentHistoryTitle}>Payment History</Text>
                {delivery.paymentHistory.map((payment, index) => (
                  <View key={payment.id || index} style={styles.paymentHistoryItem}>
                    <View style={styles.paymentHistoryRow}>
                      <Text style={styles.paymentHistoryAmount}>
                        Rs. {payment.amount.toLocaleString()}
                      </Text>
                      <Text style={styles.paymentHistoryDate}>
                        {new Date(payment.paidAt).toLocaleDateString('en-PK')}
                      </Text>
                    </View>
                    {payment.notes && (
                      <Text style={styles.paymentHistoryNotes}>{payment.notes}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Notes */}
        {order.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.label}>Order Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </Card>
        )}
      </ScrollView>

      {/* Footer Actions - Only for ready orders */}
      {isSalesman && isReady && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.footer}>
            <Button
              title="Mark as Delivered"
              onPress={() => {
                console.log('Button pressed - handleMarkDelivered');
                try {
                  handleMarkDelivered();
                } catch (error) {
                  console.error('Error in handleMarkDelivered:', error);
                  Alert.alert('Error', 'An error occurred. Please try again.');
                }
              }}
              loading={isProcessing}
              disabled={isProcessing}
              fullWidth
              size="lg"
              variant="secondary"
              icon={<Ionicons name="checkmark-circle" size={24} color={colors.text.inverse} />}
              style={styles.deliveredButton}
            />
            <View style={styles.buttonSpacing} />
            <Button
              title="Cannot Deliver"
              onPress={handleMarkNotDelivered}
              loading={isProcessing}
              fullWidth
              size="lg"
              variant="outline"
              icon={<Ionicons name="close-circle" size={24} color={colors.error} />}
              style={styles.notDeliveredButton}
            />
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Info for non-ready orders */}
      {isSalesman && !isReady && order.status !== 'delivered' && (
        <View style={styles.footer}>
          <View style={styles.disabledFooter}>
            <Ionicons name="information-circle" size={24} color={colors.warning} />
            <Text style={styles.disabledFooterText}>
              This order is not ready for delivery yet.{'\n'}
              Please wait for KPO to generate the load form.
            </Text>
          </View>
        </View>
      )}

      {/* Payment Adjustment Modal */}
      {showAdjustmentModal && delivery && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adjust Payment Amount</Text>
            <Text style={styles.modalDescription}>
              If you accidentally marked full payment but the shop owner paid less, you can correct it here.
              {'\n\n'}
              Current Amount: Rs. {(delivery.paidAmount || order.grandTotal).toLocaleString()}
              {'\n'}
              Total Amount: Rs. {order.grandTotal.toLocaleString()}
            </Text>
            
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Actual Amount Received (Rs.)</Text>
              <TextInput
                style={styles.modalInput}
                value={adjustedAmount}
                onChangeText={(text) => {
                  const filtered = text.replace(/[^0-9.]/g, '');
                  const parts = filtered.split('.');
                  if (parts.length <= 2) {
                    setAdjustedAmount(filtered);
                  }
                }}
                placeholder={order.grandTotal.toString()}
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                editable={!isProcessing}
              />
            </View>

            {adjustedAmount && !isNaN(parseFloat(adjustedAmount)) && parseFloat(adjustedAmount) < (delivery.paidAmount || order.grandTotal) && (
              <View style={styles.adjustmentSummary}>
                <Text style={styles.adjustmentSummaryText}>
                  Adjustment: Rs. -{(parseFloat(adjustedAmount) - (delivery.paidAmount || order.grandTotal)).toLocaleString()}
                </Text>
                <Text style={styles.adjustmentSummaryText}>
                  New Remaining: Rs. {(order.grandTotal - parseFloat(adjustedAmount)).toLocaleString()}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowAdjustmentModal(false);
                  setAdjustedAmount('');
                }}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={async () => {
                  const numAdjusted = parseFloat(adjustedAmount);
                  if (!adjustedAmount || isNaN(numAdjusted) || numAdjusted < 0 || numAdjusted > order.grandTotal) {
                    Alert.alert('Invalid Amount', 'Please enter a valid amount between 0 and total amount');
                    return;
                  }

                  if (numAdjusted >= (delivery.paidAmount || order.grandTotal)) {
                    Alert.alert('Invalid Adjustment', 'Adjusted amount must be less than the current paid amount');
                    return;
                  }

                  Alert.alert(
                    'Confirm Payment Adjustment',
                    `Are you sure you want to adjust the payment from Rs. ${(delivery.paidAmount || order.grandTotal).toLocaleString()} to Rs. ${numAdjusted.toLocaleString()}?\n\nThis will create an outstanding balance of Rs. ${(order.grandTotal - numAdjusted).toLocaleString()}.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Confirm Adjustment',
                        onPress: async () => {
                          setIsProcessing(true);
                          try {
                            const success = await adjustDeliveryPayment(
                              delivery.id,
                              numAdjusted,
                              notes.trim() || undefined
                            );
                            
                            if (success) {
                              // Also update order payment status
                              try {
                                await updateOrderStatus(order.id, order.status, {
                                  cashAmount: numAdjusted,
                                  creditAmount: 0,
                                  paymentMode: 'cash',
                                  paymentStatus: numAdjusted < order.grandTotal ? 'PARTIAL' : 'PAID',
                                  paidAmount: numAdjusted,
                                  remainingBalance: order.grandTotal - numAdjusted,
                                });
                              } catch (orderError) {
                                console.warn('Failed to update order status:', orderError);
                              }

                              if (Platform.OS !== 'web') {
                                try {
                                  const Toast = require('react-native-toast-message').default;
                                  Toast.show({
                                    type: 'success',
                                    text1: 'Payment Adjusted',
                                    text2: `Payment adjusted to Rs. ${numAdjusted.toLocaleString()}. Outstanding balance recorded.`,
                                    position: 'top',
                                    visibilityTime: 3000,
                                  });
                                } catch (toastError) {
                                  Alert.alert('Success', 'Payment adjusted successfully');
                                }
                              } else {
                                Alert.alert('Success', 'Payment adjusted successfully');
                              }

                              setShowAdjustmentModal(false);
                              setAdjustedAmount('');
                              setNotes('');
                              await Promise.all([loadOrders(), loadDeliveries()]);
                            } else {
                              Alert.alert('Error', 'Failed to adjust payment');
                            }
                          } catch (error: any) {
                            console.error('Error adjusting payment:', error);
                            Alert.alert('Error', error.message || 'Failed to adjust payment');
                          } finally {
                            setIsProcessing(false);
                          }
                        },
                      },
                    ]
                  );
                }}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonConfirmText}>Adjust</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.h4,
    color: colors.text.muted,
    marginVertical: spacing.lg,
  },
  notFoundSubtext: {
    ...typography.body,
    color: colors.text.muted,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    ...typography.bodyMedium,
    color: colors.warning,
    flex: 1,
  },
  itemDiscount: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  totalCard: {
    marginVertical: spacing.lg,
    padding: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  totalValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  grandTotalLabel: {
    ...typography.h4,
    color: colors.text.primary,
  },
  grandTotalValue: {
    ...typography.h3,
    color: colors.primary[500],
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  paymentModeLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  notesText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  disabledFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  disabledFooterText: {
    ...typography.bodyMedium,
    color: colors.warning,
    flex: 1,
    textAlign: 'center',
  },
  headerCard: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  orderNumber: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 4,
  },
  shopName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  shopOwner: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  shopDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  detailText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  itemCard: {
    marginBottom: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  itemQuantity: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    ...typography.caption,
    color: colors.text.muted,
  },
  itemTotal: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  paymentCard: {
    marginBottom: spacing.lg,
  },
  paymentInputContainer: {
    marginTop: spacing.md,
  },
  paymentInputLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  paymentInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAmountButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  quickAmountButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  quickAmountText: {
    ...typography.caption,
    color: colors.text.primary,
  },
  quickAmountTextActive: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  paymentSummary: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  paymentSummaryLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  paymentSummaryValue: {
    ...typography.bodyLarge,
    fontWeight: '700',
  },
  paymentModeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  paymentModeButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  paymentModeText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  paymentModeTextActive: {
    color: colors.text.inverse,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  amountInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.h4,
    color: colors.text.primary,
  },
  creditNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  creditNoteText: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
  },
  paymentSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
  },
  summaryText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  helpText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.info + '10',
    borderRadius: borderRadius.md,
  },
  helpTextContent: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
  },
  paymentInfoCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.success + '10',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  paymentInfoText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  paymentTime: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  invoiceCard: {
    marginBottom: spacing.lg,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceStatus: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  invoiceButtonText: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
  signatureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  signatureText: {
    ...typography.caption,
    color: colors.success,
  },
  notesCard: {
    marginBottom: spacing.lg,
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  failureCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.error + '10',
  },
  failureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  failureTitle: {
    ...typography.bodyMedium,
    color: colors.error,
  },
  failureReason: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  failureNotes: {
    ...typography.caption,
    color: colors.text.muted,
  },
  loadFormCard: {
    marginBottom: spacing.lg,
  },
  loadFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadFormStatus: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  loadFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  loadFormButtonText: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  deliveredButton: {
    ...shadows.md,
  },
  notDeliveredButton: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  buttonSpacing: {
    height: spacing.md,
  },
  paymentDetailsRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning + '20',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  adjustButtonText: {
    ...typography.bodyMedium,
    color: colors.warning,
    fontWeight: '600',
  },
  paymentHistorySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentHistoryTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  paymentHistoryItem: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentHistoryAmount: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: '600',
  },
  paymentHistoryDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  paymentHistoryNotes: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 500,
    ...shadows.xl,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  modalInputGroup: {
    marginBottom: spacing.lg,
  },
  modalInputLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
  },
  adjustmentSummary: {
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  adjustmentSummaryText: {
    ...typography.bodyMedium,
    color: colors.warning,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.gray[100],
  },
  modalButtonCancelText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  modalButtonConfirm: {
    backgroundColor: colors.warning,
  },
  modalButtonConfirmText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '600',
  },
});

