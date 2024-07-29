// components/Results.js

import { FaStar, FaSearch } from 'react-icons/fa';

const Results = ({ results }) => {
    if (!results) {
        return (
            <div className="mt-12 w-full max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-8 text-center">
                <FaSearch className="text-6xl text-gray-300 mb-4 mx-auto" />
                <p className="text-xl text-gray-600">Enter a search query to see results</p>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="mt-12 w-full max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-8 text-center">
                <FaSearch className="text-6xl text-gray-300 mb-4 mx-auto" />
                <p className="text-xl text-gray-600">No results found. Please try a different search query.</p>
            </div>
        );
    }

    return (
        <div className="mt-12 w-full max-w-3xl mx-auto">
            <h2 className="text-center text-3xl font-bold text-gray-800 mb-8">Top {results.length} Results</h2>
            <div className="space-y-6">
                {results.map((result, index) => (
                    <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">{result.text_chunk}</h3>
                        <div className="flex items-center text-yellow-500">
                            <FaStar className="mr-2" />
                            <span className="text-sm font-medium">Relevance: {result.score.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Results;