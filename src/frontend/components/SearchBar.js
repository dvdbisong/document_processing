import { useState } from 'react';

const SearchBar = ({ onSearch }) => {
    const [query, setQuery] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
        onSearch(query);
    };

    return (
        <form onSubmit={handleSearch} className="flex justify-center mt-8">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="px-4 py-2 border rounded-l-lg w-1/2"
                placeholder="Search..."
            />
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-r-lg">
                Search
            </button>
        </form>
    );
};

export default SearchBar;