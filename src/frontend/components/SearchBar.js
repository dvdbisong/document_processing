import { useState } from 'react';

const SearchBar = ({ onSearch }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Search failed. Please try again.');
            }
            const data = await response.json();
            onSearch(data.results);
        } catch (error) {
            console.error('Search error:', error);
            setError(error.message || 'An error occurred while searching. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="flex justify-center mt-8">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="px-4 py-2 border rounded-l-lg w-full"
                    placeholder="Search..."
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className={`px-4 py-2 bg-blue-500 text-white rounded-r-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                    disabled={isLoading}
                >
                    {isLoading ? 'Searching...' : 'Search'}
                </button>
            </form>
            {error && (
                <p className="mt-2 text-red-500 text-center">{error}</p>
            )}
        </div>
    );
};

export default SearchBar;