import { motion } from 'motion/react';
import { ChevronLeft, Check, Users as UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { PageType } from '../App';

interface ReceiptItemsPageProps {
  onNavigate: (page: PageType, groupId?: number) => void;
  theme: 'light' | 'dark';
  setReceiptData: (data: { members: Array<{ id: number; name: string; amount: number; avatar: string }>; total: number }) => void;
}

interface Item {
  id: number;
  name: string;
  price: number;
  selectedBy: number[];
}

interface Member {
  id: number;
  name: string;
  avatar: string;
}

export function ReceiptItemsPage({ onNavigate, theme, setReceiptData }: ReceiptItemsPageProps) {
  const isDark = theme === 'dark';
  
  const [members] = useState<Member[]>([
    { id: 1, name: 'You', avatar: '👤' },
    { id: 2, name: 'Sarah', avatar: '👩' },
    { id: 3, name: 'Mike', avatar: '👨' },
    { id: 4, name: 'Emma', avatar: '👧' },
  ]);

  const [items, setItems] = useState<Item[]>([
    { id: 1, name: 'Margherita Pizza', price: 18.99, selectedBy: [] },
    { id: 2, name: 'Pepperoni Pizza', price: 21.99, selectedBy: [] },
    { id: 3, name: 'Caesar Salad', price: 12.50, selectedBy: [] },
    { id: 4, name: 'Garlic Bread', price: 6.99, selectedBy: [] },
    { id: 5, name: 'Coke (2L)', price: 4.50, selectedBy: [] },
    { id: 6, name: 'Tiramisu', price: 8.99, selectedBy: [] },
  ]);

  const [selectedMember, setSelectedMember] = useState<number>(1);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const toggleItemSelection = (itemId: number) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const alreadySelected = item.selectedBy.includes(selectedMember);
        return {
          ...item,
          selectedBy: alreadySelected
            ? item.selectedBy.filter(id => id !== selectedMember)
            : [...item.selectedBy, selectedMember]
        };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items
      .filter(item => item.selectedBy.length > 0)
      .reduce((sum, item) => sum + item.price, 0);
  };

  const calculateMemberTotal = (memberId: number) => {
    return items.reduce((sum, item) => {
      if (item.selectedBy.includes(memberId)) {
        // Split the cost among all people who selected this item
        return sum + (item.price / item.selectedBy.length);
      }
      return sum;
    }, 0);
  };

  const allItemsSelected = items.every(item => item.selectedBy.length > 0);

  const handleSubmit = () => {
    if (allItemsSelected) {
      const receiptData = {
        members: members.map(member => ({
          id: member.id,
          name: member.name,
          amount: calculateMemberTotal(member.id),
          avatar: member.avatar
        })),
        total: calculateTotal()
      };
      setReceiptData(receiptData);
      onNavigate('processing');
    }
  };

  const addManualItem = () => {
    if (newItemName && newItemPrice) {
      const newPrice = parseFloat(newItemPrice);
      if (!isNaN(newPrice)) {
        const newItem: Item = {
          id: items.length + 1,
          name: newItemName,
          price: newPrice,
          selectedBy: []
        };
        setItems([...items, newItem]);
        setNewItemName('');
        setNewItemPrice('');
        setShowManualEntry(false);
      }
    }
  };

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4`}
      >
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => onNavigate('receiptScan')}
            className={`w-9 h-9 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center active:scale-95 transition-transform`}
          >
            <ChevronLeft size={20} className={isDark ? 'text-white' : 'text-slate-800'} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Split Items</h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pizza Palace • ${calculateTotal().toFixed(2)}
            </p>
          </div>
        </div>

        {/* Member Selection */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full font-medium transition-all ${
                selectedMember === member.id
                  ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white shadow-lg'
                  : isDark
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-gray-200 text-slate-600'
              }`}
            >
              <span className="mr-2">{member.avatar}</span>
              {member.name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-3">{items.map((item, index) => {
          const isSelected = item.selectedBy.includes(selectedMember);
          const splitCount = item.selectedBy.length;
          const splitPrice = splitCount > 0 ? item.price / splitCount : item.price;

          return (
            <motion.button
              key={item.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              onClick={() => toggleItemSelection(item.id)}
              className={`w-full ${
                isDark ? 'bg-slate-800' : 'bg-white'
              } rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isSelected 
                    ? 'bg-blue-500 border-blue-500' 
                    : isDark 
                      ? 'border-slate-600' 
                      : 'border-gray-300'
                }`}>
                  {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {item.name}
                  </p>
                  {splitCount > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex -space-x-1">
                        {item.selectedBy.map((memberId) => {
                          const member = members.find(m => m.id === memberId);
                          return (
                            <div 
                              key={memberId}
                              className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border border-white flex items-center justify-center text-xs"
                            >
                              {member?.avatar}
                            </div>
                          );
                        })}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Split {splitCount} {splitCount === 1 ? 'way' : 'ways'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    ${item.price.toFixed(2)}
                  </p>
                  {splitCount > 0 && (
                    <p className="text-xs text-blue-500 font-medium">
                      ${splitPrice.toFixed(2)} each
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
        </div>

        {/* Manual Entry */}
        {showManualEntry && (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item Name"
                className={`w-full px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-800'} border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <input
                type="text"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                className={`w-full px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-800'} border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={addManualItem}
                className={`px-4 py-2 rounded-xl font-semibold shadow-lg transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
                    : 'bg-blue-500 text-white active:scale-[0.98]'
                }`}
              >
                Add
              </button>
            </div>
          </div>
        )}
        {!showManualEntry && (
          <button
            onClick={() => setShowManualEntry(true)}
            className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
              isDark
                ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
                : 'bg-blue-500 text-white active:scale-[0.98]'
            }`}
          >
            Add Manual Item
          </button>
        )}
      </div>

      {/* Summary Bar */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-5 py-4`}>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {members.find(m => m.id === selectedMember)?.name}'s Total
            </p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              ${calculateMemberTotal(selectedMember).toFixed(2)}
            </p>
          </div>
          {!allItemsSelected && (
            <p className="text-xs text-orange-500">
              ⚠️ All items must be selected before submitting
            </p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allItemsSelected}
          className={`w-full py-4 rounded-xl font-semibold shadow-lg transition-all ${
            allItemsSelected
              ? 'bg-gradient-to-r from-slate-600 to-blue-500 text-white active:scale-[0.98]'
              : isDark 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Submit & Charge Cards
        </button>
      </div>
    </div>
  );
}