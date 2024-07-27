import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import Results from '../components/Results';

export default function Home() {
    const [searchResults, setSearchResults] = useState([]);
    const [searchPerformed, setSearchPerformed] = useState(false);

    const handleSearch = (results) => {
        setSearchResults(results);
        setSearchPerformed(true);
    };

    return (
        <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold text-center my-8">Document Search</h1>
            <SearchBar onSearch={handleSearch} />
            {searchPerformed && <Results results={searchResults} />}
        </div>
    );
}