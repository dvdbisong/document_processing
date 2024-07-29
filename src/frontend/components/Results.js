// components/Results.js

import { FaStar } from 'react-icons/fa';

const Results = ({ results }) => {
    if (!results || results.length === 0) {
        return (
            <div className="mt-8 text-center text-gray-600">
                <p>No results found. Please try a different search query.</p>
            </div>
        );
    }

    return (
        <div className="mt-8 w-full max-w-3xl mx-auto">
            <h2 className="text-center text-2xl font-bold text-gray-800 mb-6">Top {results.length} Results</h2>
            <div className="space-y-4">
                {results.map((result, index) => (
                    <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">{result.text_chunk}</h3>
                        <div className="flex items-center text-yellow-500">
                            <FaStar className="mr-1" />
                            <span className="text-sm font-medium">Relevance: {result.score.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Results;