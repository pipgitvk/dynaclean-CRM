// components/Modal.jsx
import React from "react";

const Modal = ({ isOpen, onClose, children, title = "Details" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0  bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all sm:my-8 sm:align-middle sm:max-w-md md:max-w-lg lg:max-w-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-semibold focus:outline-none"
          >
            &times;
          </button>
        </div>
        <div className="p-6">{children}</div>
        <div className="px-6 py-4 border-t border-gray-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
