#include "pahak.h"

#include <math.h>
#include <stddef.h>

#define CHECK(expression) do { if (!(expression)) return 1; } while (0)

int main(void)
{
    double normal_samples[128 * 2];
    double normal_score;
    double anomaly_score;
    double anomaly[2] = {10.0, 10.0};
    PahakConfig config = pahak_default_config();
    PahakModel *model = NULL;
    size_t i;

    for (i = 0; i < 128; ++i) {
        double value = ((double)i - 63.5) / 63.5;
        normal_samples[i * 2] = value;
        normal_samples[i * 2 + 1] = value * 0.5;
    }

    config.tree_count = 100;
    config.sample_size = 128;
    config.seed = 42;
    CHECK(pahak_model_train(normal_samples, 128, 2, &config, &model) == PAHAK_OK);
    CHECK(model != NULL);

    {
        double ordinary[2] = {0.0, 0.0};
        CHECK(pahak_model_score(model, ordinary, 2, &normal_score) == PAHAK_OK);
        CHECK(pahak_model_score(model, anomaly, 2, &anomaly_score) == PAHAK_OK);
    }

    CHECK(anomaly_score > normal_score);
    CHECK(isfinite(normal_score));
    CHECK(isfinite(anomaly_score));
    CHECK(normal_score >= 0.0 && normal_score <= 1.0);
    CHECK(anomaly_score >= 0.0 && anomaly_score <= 1.0);

    CHECK(pahak_model_score(model, anomaly, 1, &anomaly_score) == PAHAK_INVALID_ARGUMENT);
    pahak_model_free(model);

    model = NULL;
    CHECK(pahak_model_train(NULL, 128, 2, &config, &model) == PAHAK_INVALID_ARGUMENT);
    CHECK(model == NULL);
    return 0;
}
