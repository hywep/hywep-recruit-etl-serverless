import {Client as ElasticClient} from "@elastic/elasticsearch";

const esClient = new ElasticClient({
    node: process.env.ELASTICSEARCH_ENDPOINT || "http://localhost:9200",
});

export async function saveToElasticsearch(data: any[]): Promise<void> {
    for (const item of data) {
        await esClient.index({
            index: process.env.ELASTICSEARCH_INDEX!,
            document: item,
        });
    }
    console.log("Data saved to Elasticsearch.");
}
