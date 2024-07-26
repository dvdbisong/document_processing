import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import Results from '../components/Results';

export default function Home() {
    const [results, setResults] = useState([]);

    const handleSearch = async (query) => {
        const response = await fetch(`/api/search?query=${query}`);
        const data = await response.json();
        setResults(data.results);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="container mx-auto px-4">
                <h1 className="text-center text-4xl font-bold mt-8">Vector Search</h1>
                <SearchBar onSearch={handleSearch} />
                <Results results={results} />
            </div>
        </div>
    );
}