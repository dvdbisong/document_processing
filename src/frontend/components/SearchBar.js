// components/SearchBar.js

import { useState } from 'react';
import { FaSearch, FaUpload } from 'react-icons/fa';

const SearchBar = ({ onSearch }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadStatus, setUploadStatus] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) {
            setError('Please enter a search query');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Search failed. Please try again.');
            }
            onSearch(data.results || []);
        } catch (error) {
            console.error('Search error:', error);
            setError(error.message || 'An error occurred while searching. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        setUploadStatus('Uploading...');

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            setUploadStatus(result.message || 'Upload successful!');
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('Upload failed. Please try again.');
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-6">
            <form onSubmit={handleSearch} className="flex items-center mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search..."
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className={`px-6 py-2 bg-blue-500 text-white rounded-r-lg transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                    disabled={isLoading}
                >
                    {isLoading ? 'Searching...' : <FaSearch />}
                </button>
            </form>
            {error && (
                <p className="mt-2 text-red-500 text-center">{error}</p>
            )}
            <div className="mt-4">
                <label htmlFor="file-upload" className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer hover:bg-green-600 transition-colors">
                    <FaUpload className="mr-2" />
                    Upload Files
                </label>
                <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                />
                {uploadStatus && (
                    <p className="mt-2 text-center text-sm font-medium text-gray-600">{uploadStatus}</p>
                )}
            </div>
        </div>
    );
};

export default SearchBar;