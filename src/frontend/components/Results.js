// components/Results.js

const Results = ({ results }) => {
    if (!results || results.length === 0) {
        return (
            <div className="mt-8 text-center">
                <p>No results found. Please try a different search query.</p>
            </div>
        );
    }

    return (
        <div className="mt-8">
            <h2 className="text-center text-2xl font-bold">Top {results.length} Results</h2>
            <div className="mt-4 grid grid-cols-1 gap-4">
                {results.map((result, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                        <h3 className="text-lg font-bold">{result.text_chunk}</h3>
                        <p className="text-gray-500">Relevance: {result.score.toFixed(2)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Results;