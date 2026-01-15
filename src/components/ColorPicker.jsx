import React, { useState, useRef, useEffect } from 'react';
import '../styles/ColorPicker.css';

const presetColors = [
  '#7E8087', '#3498db', '#9b59b6', '#2ecc71', '#e67e22', 
  '#e74c3c', '#f39c12', '#1abc9c', '#34495e', '#e91e63'
];

function ColorPicker({ color, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState('top');
  const pickerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      if (pickerRef.current && dropdownRef.current) {
        const rect = pickerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 80;
        const dropdownWidth = 180;
        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft = rect.left;
        
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
        
        if (dropdownRef.current) {
          if (spaceRight < dropdownWidth && spaceLeft > spaceRight) {
            dropdownRef.current.style.left = 'auto';
            dropdownRef.current.style.right = '0';
          } else {
            dropdownRef.current.style.left = '0';
            dropdownRef.current.style.right = 'auto';
          }
        }
      }
      
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleColorSelect = (selectedColor) => {
    onChange(selectedColor);
    setIsOpen(false);
  };

  return (
    <div className="color-picker-container" ref={pickerRef}>
      <div className="color-picker-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="color-preview" style={{ backgroundColor: color }}></div>
        <span className="color-label">{label}</span>
      </div>
      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`color-picker-dropdown ${dropdownPosition === 'top' ? 'dropdown-top' : 'dropdown-bottom'}`}
        >
          <div className="preset-colors">
            {presetColors.map((presetColor, index) => (
              <div
                key={index}
                className={`color-option ${color === presetColor ? 'selected' : ''}`}
                style={{ backgroundColor: presetColor }}
                onClick={() => handleColorSelect(presetColor)}
                title={presetColor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
