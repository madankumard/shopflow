package com.shopflow.product;

import java.util.Collection;
import java.util.List;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long> {

	boolean existsBySku(String sku);

	/** Products at or below a stock level, the emptiest first. */
	List<Product> findByStockQuantityLessThanEqualOrderByStockQuantityAscNameAsc(int stockQuantity);

	/**
	 * Loads products and locks their rows until the transaction ends, so two orders placed at
	 * the same moment cannot both take the last item. Always in id order, which stops two
	 * orders for the same products from deadlocking each other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from Product p where p.id in :ids order by p.id")
	List<Product> findAllByIdForUpdate(Collection<Long> ids);

}
