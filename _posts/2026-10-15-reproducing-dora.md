---
title: "Reproducing DoRA: Does the Improvement Over LoRA Hold?"
description: Reproducing DoRA on Llama-3-8B with a modern PEFT stack, under matched learning rates and 4-bit quantization.
date: 2026-10-15
paper: Pending
github: https://github.com/tardelr/dora-case-studies
huggingface: https://huggingface.co/tardelr/lora-dora-reproducibility
---

## 1. Introduction

LoRA has become the industry standard for Parameter-Efficient Fine-Tuning (PEFT). More recently, DoRA [[1]](#ref-1) was introduced as an extension of LoRA.

DoRA, simply put, decomposes weights into magnitude and direction components. It learns the magnitude directly while using LoRA to update the direction. The authors reported an improvement of 4.41 percentage points in average accuracy over LoRA on commonsense reasoning benchmarks using Llama-3-8B.

The objective of this study is to reproduce the authors' results using a modern PEFT stack, and assess whether the reported improvements hold under different learning rates and 4-bit quantization.

<!--more-->

We also investigate whether DoRA exhibits the magnitude–direction update behavior described by the original authors.

## 2. Reproduction

We follow the original authors' experimental setup as closely as possible, using the same model (Llama-3-8B), dataset (Commonsense-170K [[2]](#ref-2)), adapter configuration, and evaluation benchmarks.

There is, however, one important detail in the original experiments: LoRA and DoRA were trained using different learning rates.

- LoRA: 3e-4
- DoRA: 1e-4

We reproduce the original configuration and introduce an additional comparison in which both methods use the same learning rate (1e-4).

We also extend the experiments to 4-bit quantization, comparing QLoRA [[3]](#ref-3) and QDoRA.

For the learning-rate-matched and quantized comparisons, we use two different seeds (42 and 43). The reproduction of the original LoRA learning rate uses only one seed due to computational constraints.

Unlike the original study, we use a modern implementation of DoRA through Hugging Face PEFT, rather than the authors' custom implementation.

|Condition|Learning rate|Quantization|Seeds|
|---|---|---|---|
|LoRA, original LR|3e-4|None|42|
|LoRA, matched LR|1e-4|None|42, 43|
|DoRA|1e-4|None|42, 43|
|QLoRA|1e-4|4-bit NF4|42, 43|
|QDoRA|1e-4|4-bit NF4|42, 43|

All runs share the same adapter configuration (rank 32, α = 64, adapters on `q_proj`, `k_proj`, `v_proj`, `up_proj` and `down_proj`), 3 epochs, and bf16 training on a single H100.

### A note on QDoRA: a bug in TRL

While running the quantized experiments, we found that QDoRA's magnitude vector wasn't being trained at all.

When the base model is quantized, TRL's `SFTTrainer` casts every trainable parameter to bf16, following the QLoRA recommendation. That's fine for LoRA's A and B matrices, but it also caught DoRA's magnitude vector. Stored in bf16 without an fp32 master copy, each update rounds back to the parameter's current value, so the magnitude stays frozen. Nothing fails: the run still trains and evaluates normally.

We isolated it with two diagnostic runs that differ only in the dtype of the magnitude vector. In the bf16 run, no magnitude tensor changed in 2,000 steps. With the magnitude in fp32, every tensor had moved by step 50.

![QDoRA magnitude movement across checkpoints, bf16 vs fp32 magnitude: with bf16 the fraction of changed magnitude tensors and the median relative L2 change stay at zero for 2,000 steps; with fp32 every tensor changes by step 50 and the median relative change grows to about 0.0022](/assets/img/dora_qdora_magnitude_movement.png)
*Magnitude movement in the two diagnostic QDoRA runs. Left: fraction of magnitude tensors that changed. Right: median relative L2 change from the first snapshot.*

All QDoRA results in this post use the corrected setup, with the magnitude vector kept in fp32. We reported the bug to TRL ([huggingface/trl#7268](https://github.com/huggingface/trl/issues/7268)); it was confirmed and then fixed in [huggingface/trl#7342](https://github.com/huggingface/trl/pull/7342), released in TRL v1.15.0.

## 3. Results

### 3.1 Accuracy

Our results reproduce the original authors' reported performance advantage when using their original learning rates.

However, when matching learning rates, the difference between LoRA and DoRA becomes considerably smaller.

|Configuration|LoRA / QLoRA|DoRA / QDoRA|Difference|
|---|--:|--:|--:|
|Original paper|80.79 %|85.20 %|+4.41 pp|
|Our reproduction (original LRs)|81.45 %|85.12 %|+3.67 pp|
|Our reproduction (matched LR)|84.93 %|85.12 %|+0.20 pp|
|4-bit quantization (matched LR)|85.51 %|85.28 %|−0.24 pp|

With matched learning rates, the average advantage falls to just 0.20 percentage points, with opposite results across our two seeds.

Under 4-bit quantization, we observe similar results, with QLoRA slightly outperforming QDoRA in both seeds.

These results suggest that the reported improvement is sensitive to the baseline learning rate, rather than demonstrating a consistent advantage for DoRA in our setup.

![Average commonsense accuracy, LoRA/QLoRA vs DoRA/QDoRA: original paper 80.79 vs 85.20; our reproduction with original LRs 81.45 vs 85.12; matched LR 84.93 vs 85.12; 4-bit with matched LR 85.51 vs 85.28](/assets/img/dora_accuracy.png)

### 3.2 Mechanistic Analysis

Besides reporting higher accuracy, the original authors argued that DoRA produces weight updates that more closely resemble full fine-tuning.

Specifically, they observed a negative correlation between magnitude and directional changes, whereas LoRA exhibited a positive correlation.

We attempted to reproduce this behavior by measuring magnitude and directional changes across the first six layers of Llama-3-8B, using checkpoints collected throughout training.

However, neither our full-precision nor quantized experiments reproduced the negative correlation reported by the original authors.

Instead, we observed positive relationships across all evaluated configurations, including when accounting for differences between layers.

![Magnitude change vs directional change for q_proj, one panel per run, points colored by layer and shaped by checkpoint: every fitted slope is positive, from 0.227 (DoRA, seed 43) to 1.76 (QDoRA-fp32, seed 43)](/assets/img/dora_mech_delta_m_vs_delta_d_q_proj.png)
*Magnitude change (ΔM) vs directional change (ΔD) for `q_proj`, at 25 %, 50 %, 75 % and the end of training.*

![Magnitude change vs directional change for v_proj, one panel per run, points colored by layer and shaped by checkpoint](/assets/img/dora_mech_delta_m_vs_delta_d_v_proj.png)
*The same analysis for `v_proj`.*

![Mean magnitude change per transformer layer (0 to 5) for q_proj, one panel per run, one line per checkpoint](/assets/img/dora_mech_delta_m_by_layer_q_proj.png)
*Magnitude change through layers for `q_proj`, per checkpoint.*

![Mean magnitude change per transformer layer (0 to 5) for v_proj, one panel per run, one line per checkpoint](/assets/img/dora_mech_delta_m_by_layer_v_proj.png)
*Magnitude change through layers for `v_proj`, per checkpoint.*

![Slope of the relative low-rank coefficient update vs checkpoint fraction, per layer, for q_proj and v_proj: full-precision LoRA and DoRA runs sit between 0.035 and 0.061 (q_proj) and 0.068 and 0.096 (v_proj), while the quantized runs stay at or below about 0.012](/assets/img/dora_mech_coefficient_update_slopes_by_layer.png)
*How fast the low-rank coefficients grow over training, per layer.*

An important distinction is that the original mechanistic analysis used a different architecture and task setting. Therefore, our results show that the reported behavior does not transfer to our Llama-3 experiments, rather than disproving the original observations.

## 4. Conclusion

Our experiments successfully reproduced the original DoRA accuracy improvement when using the authors' published configuration.

However, when matching the learning rates, the reported advantage largely disappeared. We observed similar results under 4-bit quantization, where QDoRA slightly underperformed QLoRA.

We also couldn't reproduce the magnitude–direction behavior reported by the original authors in our experimental setup.

There are important limitations to this study. Due to computational constraints, we tested only two learning rates for LoRA and one for DoRA, with two seeds for the main comparisons. We also restricted our experiments to a single model, adapter rank, and task family.

Therefore, we cannot claim that DoRA's reported improvements don't exist, or that the methods are equivalent. Rather, we couldn't reproduce a stable advantage for DoRA under our matched configurations.

The broader takeaway is that PEFT comparisons can be particularly sensitive to baseline configuration, and improvements over LoRA should be evaluated against appropriately tuned baselines.

## References

<a id="ref-1"></a>[1] Liu, S.-Y., Wang, C.-Y., Yin, H., Molchanov, P., Wang, Y.-C. F., Cheng, K.-T., & Chen, M.-H. (2024). _DoRA: Weight-Decomposed Low-Rank Adaptation_. ICML 2024. [arXiv:2402.09353](https://arxiv.org/abs/2402.09353)

<a id="ref-2"></a>[2] Hu, Z., Wang, L., Lan, Y., Xu, W., Lim, E.-P., Bing, L., Xu, X., Poria, S., & Lee, R. K.-W. (2023). _LLM-Adapters: An Adapter Family for Parameter-Efficient Fine-Tuning of Large Language Models_. EMNLP 2023. [arXiv:2304.01933](https://arxiv.org/abs/2304.01933)

<a id="ref-3"></a>[3] Dettmers, T., Pagnoni, A., Holtzman, A., & Zettlemoyer, L. (2023). _QLoRA: Efficient Finetuning of Quantized LLMs_. NeurIPS 2023. [arXiv:2305.14314](https://arxiv.org/abs/2305.14314)
